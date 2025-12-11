/**
 * Position Mapper for Detective D
 * 
 * Maps LLM-returned positions to canonical line/column numbers
 * Handles truncated content, position indices, and approximate line numbers
 */

import { logger } from './logger.js';

/**
 * Truncation map from analyze.ts
 */
export interface TruncationMap {
  was_truncated: boolean;
  original_length: number;
  truncated_length: number;
  head_chars: number;
  tail_chars: number;
  error_windows: Array<{
    start: number;
    end: number;
    reason: string;
  }>;
  omitted_ranges: Array<{
    start: number;
    end: number;
  }>;
}

/**
 * Position information from LLM
 */
export interface LLMPosition {
  line?: number;
  column?: number;
  position?: number;  // Character index
  snippet?: string;   // Code snippet for verification
}

/**
 * Normalized position result
 */
export interface NormalizedPosition {
  line: number | null;
  column: number | null;
  confidence: number;  // 0-1, how confident we are in the position
  notes?: string;      // Explanation if approximate or uncertain
  original_position?: number;  // Original character position
  is_approximate?: boolean;
}

/**
 * Convert 0-based character position to 1-based line/column
 */
export function positionToLineColumn(
  content: string,
  position: number
): { line: number; column: number } {
  // Clamp position to valid range
  position = Math.max(0, Math.min(position, content.length));

  let line = 1;
  let column = 1;
  let currentPos = 0;

  for (let i = 0; i < position && i < content.length; i++) {
    currentPos = i;
    
    if (content[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return { line, column };
}

/**
 * Convert 1-based line/column to 0-based character position
 */
export function lineColumnToPosition(
  content: string,
  line: number,
  column: number = 1
): number {
  const lines = content.split('\n');
  
  // Validate line number
  if (line < 1 || line > lines.length) {
    return -1;
  }

  // Calculate position
  let position = 0;
  
  // Add lengths of all previous lines (including newlines)
  for (let i = 0; i < line - 1; i++) {
    position += lines[i].length + 1; // +1 for newline
  }

  // Add column offset (clamped to line length)
  const lineContent = lines[line - 1];
  const colOffset = Math.min(column - 1, lineContent.length);
  position += colOffset;

  return position;
}

/**
 * Map position from truncated content to original content
 */
export function mapTruncatedPosition(
  truncatedPosition: number,
  truncationMap: TruncationMap
): number | null {
  // If content wasn't truncated, position is unchanged
  if (!truncationMap.was_truncated) {
    return truncatedPosition;
  }

  // Position in head section (unchanged)
  if (truncatedPosition < truncationMap.head_chars) {
    return truncatedPosition;
  }

  // Position in tail section (need to map back)
  const tailStartInTruncated = truncationMap.truncated_length - truncationMap.tail_chars;
  if (truncatedPosition >= tailStartInTruncated) {
    const offsetInTail = truncatedPosition - tailStartInTruncated;
    const tailStartInOriginal = truncationMap.original_length - truncationMap.tail_chars;
    return tailStartInOriginal + offsetInTail;
  }

  // Position in error window section
  // This is more complex - need to identify which window it belongs to
  for (const window of truncationMap.error_windows) {
    // Calculate window position in truncated content
    // This is approximate since we need to account for truncation markers
    // For now, we'll return the window start as a best guess
    const windowOriginalStart = window.start;
    const windowOriginalEnd = window.end;
    
    // If the position seems to be in this window's range
    // (This is an approximation - exact mapping requires tracking window positions in truncated content)
    return windowOriginalStart;
  }

  // Position is in an omitted range - cannot map precisely
  return null;
}

/**
 * Verify if a snippet matches content at a given line
 * Returns confidence score (0-1) and whether it's an exact match
 */
export function verifySnippetAtLine(
  content: string,
  line: number,
  snippet: string,
  searchWindow: number = 3  // Check ±N lines
): { matches: boolean; confidence: number; actualLine?: number } {
  const lines = content.split('\n');
  
  // Validate line number
  if (line < 1 || line > lines.length) {
    return { matches: false, confidence: 0 };
  }

  // Normalize snippet for comparison (trim, lowercase)
  const normalizedSnippet = snippet.trim().toLowerCase();
  
  if (normalizedSnippet.length === 0) {
    return { matches: false, confidence: 0.5 };  // No snippet to verify
  }

  // Check exact line first
  const exactLine = lines[line - 1];
  if (exactLine.toLowerCase().includes(normalizedSnippet)) {
    return { matches: true, confidence: 1.0, actualLine: line };
  }

  // Check nearby lines within window
  const startLine = Math.max(1, line - searchWindow);
  const endLine = Math.min(lines.length, line + searchWindow);

  for (let i = startLine; i <= endLine; i++) {
    const currentLine = lines[i - 1];
    if (currentLine.toLowerCase().includes(normalizedSnippet)) {
      // Found in nearby line - lower confidence based on distance
      const distance = Math.abs(i - line);
      const confidence = 1.0 - (distance * 0.2); // Reduce by 0.2 per line distance
      return { 
        matches: true, 
        confidence: Math.max(confidence, 0.5),
        actualLine: i 
      };
    }
  }

  // Check if any line contains significant portion of snippet
  const snippetWords = normalizedSnippet.split(/\s+/).filter(w => w.length > 3);
  if (snippetWords.length > 0) {
    for (let i = startLine; i <= endLine; i++) {
      const currentLine = lines[i - 1].toLowerCase();
      const matchedWords = snippetWords.filter(word => currentLine.includes(word));
      
      if (matchedWords.length >= snippetWords.length * 0.6) {
        // At least 60% of significant words match
        const distance = Math.abs(i - line);
        const wordMatchRatio = matchedWords.length / snippetWords.length;
        const confidence = wordMatchRatio * (1.0 - distance * 0.15);
        return {
          matches: true,
          confidence: Math.max(confidence, 0.4),
          actualLine: i
        };
      }
    }
  }

  return { matches: false, confidence: 0 };
}

/**
 * Normalize LLM position to canonical line/column
 * This is the main entry point for position normalization
 */
export function normalizePosition(
  llmPosition: LLMPosition,
  originalContent: string,
  truncationMap?: TruncationMap,
  requestId?: string
): NormalizedPosition {
  const logContext = { request_id: requestId };

  // Case 1: Line and column both provided
  if (llmPosition.line !== undefined && llmPosition.column !== undefined) {
    const lines = originalContent.split('\n');
    
    // Validate line number
    if (llmPosition.line < 1 || llmPosition.line > lines.length) {
      logger.warn('LLM provided invalid line number', {
        ...logContext,
        llm_line: llmPosition.line,
        max_lines: lines.length,
      });
      
      return {
        line: null,
        column: null,
        confidence: 0.2,
        notes: `Invalid line number ${llmPosition.line} (file has ${lines.length} lines)`,
      };
    }

    // Validate column number
    const lineContent = lines[llmPosition.line - 1];
    const validColumn = Math.min(llmPosition.column, lineContent.length + 1);

    // Verify snippet if provided
    if (llmPosition.snippet) {
      const verification = verifySnippetAtLine(
        originalContent,
        llmPosition.line,
        llmPosition.snippet
      );

      if (verification.matches && verification.actualLine !== undefined) {
        if (verification.actualLine !== llmPosition.line) {
          // Snippet found at different line - adjust
          logger.debug('LLM line number adjusted based on snippet verification', {
            ...logContext,
            llm_line: llmPosition.line,
            actual_line: verification.actualLine,
            confidence: verification.confidence,
          });

          return {
            line: verification.actualLine,
            column: validColumn,
            confidence: verification.confidence,
            notes: `Adjusted from line ${llmPosition.line} based on snippet match`,
            is_approximate: true,
          };
        } else {
          // Exact match - high confidence
          return {
            line: llmPosition.line,
            column: validColumn,
            confidence: 1.0,
          };
        }
      } else if (!verification.matches) {
        // Snippet doesn't match - lower confidence
        logger.warn('LLM snippet does not match line content', {
          ...logContext,
          llm_line: llmPosition.line,
          snippet: llmPosition.snippet.substring(0, 50),
        });

        return {
          line: llmPosition.line,
          column: validColumn,
          confidence: 0.6,
          notes: 'Line number may be approximate (snippet does not match)',
          is_approximate: true,
        };
      }
    }

    // No snippet or verification not possible - moderate confidence
    return {
      line: llmPosition.line,
      column: validColumn,
      confidence: 0.8,
    };
  }

  // Case 2: Only line provided (no column)
  if (llmPosition.line !== undefined) {
    const lines = originalContent.split('\n');
    
    // Validate line number
    if (llmPosition.line < 1 || llmPosition.line > lines.length) {
      logger.warn('LLM provided invalid line number', {
        ...logContext,
        llm_line: llmPosition.line,
        max_lines: lines.length,
      });
      
      return {
        line: null,
        column: null,
        confidence: 0.2,
        notes: `Invalid line number ${llmPosition.line} (file has ${lines.length} lines)`,
      };
    }

    // Verify snippet if provided
    if (llmPosition.snippet) {
      const verification = verifySnippetAtLine(
        originalContent,
        llmPosition.line,
        llmPosition.snippet
      );

      if (verification.matches && verification.actualLine !== undefined) {
        return {
          line: verification.actualLine,
          column: null,
          confidence: verification.confidence,
          notes: verification.actualLine !== llmPosition.line 
            ? `Adjusted from line ${llmPosition.line} based on snippet match`
            : undefined,
          is_approximate: verification.actualLine !== llmPosition.line,
        };
      }
    }

    return {
      line: llmPosition.line,
      column: null,
      confidence: 0.7,
    };
  }

  // Case 3: Only position provided (character index)
  if (llmPosition.position !== undefined) {
    let originalPosition = llmPosition.position;

    // Map from truncated content to original content if needed
    if (truncationMap && truncationMap.was_truncated) {
      const mappedPosition = mapTruncatedPosition(originalPosition, truncationMap);
      
      if (mappedPosition === null) {
        logger.warn('Position maps to omitted range in truncated content', {
          ...logContext,
          truncated_position: originalPosition,
        });
        
        return {
          line: null,
          column: null,
          confidence: 0.1,
          notes: 'Position is in omitted section of truncated content',
          original_position: originalPosition,
        };
      }
      
      originalPosition = mappedPosition;
      
      logger.debug('Mapped truncated position to original', {
        ...logContext,
        truncated_position: llmPosition.position,
        original_position: originalPosition,
      });
    }

    // Convert position to line/column
    const lineCol = positionToLineColumn(originalContent, originalPosition);

    // Verify snippet if provided
    if (llmPosition.snippet) {
      const verification = verifySnippetAtLine(
        originalContent,
        lineCol.line,
        llmPosition.snippet
      );

      if (verification.matches && verification.actualLine !== undefined) {
        // Recalculate position based on verified line
        const verifiedPosition = lineColumnToPosition(
          originalContent,
          verification.actualLine,
          lineCol.column
        );

        return {
          line: verification.actualLine,
          column: lineCol.column,
          confidence: verification.confidence,
          original_position: verifiedPosition >= 0 ? verifiedPosition : originalPosition,
          notes: verification.actualLine !== lineCol.line
            ? `Adjusted from line ${lineCol.line} based on snippet match`
            : undefined,
          is_approximate: verification.actualLine !== lineCol.line,
        };
      }
    }

    return {
      line: lineCol.line,
      column: lineCol.column,
      confidence: truncationMap?.was_truncated ? 0.7 : 0.9,
      original_position: originalPosition,
      notes: truncationMap?.was_truncated 
        ? 'Position mapped from truncated content'
        : undefined,
    };
  }

  // Case 4: No position information provided
  logger.warn('LLM did not provide any position information', logContext);
  
  return {
    line: null,
    column: null,
    confidence: 0,
    notes: 'No position information provided by LLM',
  };
}

/**
 * Normalize an array of LLM errors with position mapping
 */
export interface LLMError {
  line?: number | null;
  column?: number | null;
  position?: number | null;
  message?: string;
  explanation?: string;
  confidence?: number;
  [key: string]: any;
}

export function normalizeErrorPositions(
  errors: LLMError[],
  originalContent: string,
  truncationMap?: TruncationMap,
  requestId?: string
): LLMError[] {
  return errors.map((error, index) => {
    // Extract snippet from explanation or message if available
    let snippet: string | undefined;
    if (error.explanation) {
      // Try to extract code snippet from explanation (often in quotes or backticks)
      const snippetMatch = error.explanation.match(/`([^`]+)`|"([^"]+)"|'([^']+)'/);
      if (snippetMatch) {
        snippet = snippetMatch[1] || snippetMatch[2] || snippetMatch[3];
      }
    }

    // Normalize position
    const normalizedPos = normalizePosition(
      {
        line: error.line ?? undefined,
        column: error.column ?? undefined,
        position: error.position ?? undefined,
        snippet,
      },
      originalContent,
      truncationMap,
      requestId
    );

    // Update error with normalized position
    const normalizedError = { ...error };
    normalizedError.line = normalizedPos.line ?? undefined;
    normalizedError.column = normalizedPos.column ?? undefined;

    // Adjust confidence if provided
    if (error.confidence !== undefined && normalizedPos.confidence < 1.0) {
      // Multiply confidences (both position and error confidence matter)
      normalizedError.confidence = error.confidence * normalizedPos.confidence;
    } else if (error.confidence === undefined) {
      // Use position confidence as error confidence
      normalizedError.confidence = normalizedPos.confidence;
    }

    // Add notes if position is approximate
    if (normalizedPos.is_approximate && normalizedPos.notes) {
      normalizedError.position_note = normalizedPos.notes;
    }

    // Log if position confidence is low
    if (normalizedPos.confidence < 0.5) {
      logger.warn('Low confidence in error position', {
        request_id: requestId,
        error_index: index,
        confidence: normalizedPos.confidence,
        notes: normalizedPos.notes,
        original_line: error.line,
        normalized_line: normalizedPos.line,
      });
    }

    return normalizedError;
  });
}

