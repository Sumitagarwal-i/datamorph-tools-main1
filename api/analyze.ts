/**
 * POST /api/analyze - Main endpoint for error detection and analysis
 * Validates request, detects errors, and streams/returns analysis
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { rateLimiter } from './lib/rateLimiter';
import { requestValidator, handleValidationError } from './lib/requestValidator';
import { logger, Logger } from './lib/logger';
import { retrieveRAGSnippets, formatRAGSnippetsForPrompt, getRAGStatus } from './lib/ragGrounding';
import { callLLM, getProviderInfo } from './lib/llmProvider';
import { randomUUID } from 'crypto';
import { parse as parseCsv } from 'csv-parse/sync';
import * as yaml from 'js-yaml';
import { getCachedAnalysis, cacheAnalysisResult, computeContentHash } from './lib/cacheManager';
import { logTelemetryAsync } from './lib/telemetryLogger';

// Allowed file types
const ALLOWED_FILE_TYPES = ['auto', 'json', 'csv', 'xml', 'yaml'] as const;
type FileType = typeof ALLOWED_FILE_TYPES[number];

// Truncation configuration
const LLM_SAFE_CHARS = 12000; // Safe character limit for full content
const HEAD_CHARS = 6000; // Characters to take from start
const TAIL_CHARS = 4000; // Characters to take from end
const ERROR_WINDOW_CHARS = 500; // Characters around error positions (±500)

// Parser hint interface
interface ParserHint {
  type: 'syntax_error' | 'structure_error' | 'warning';
  message: string;
  position?: number;
  line?: number;
  column?: number;
  row?: number;
  category?: string;
  extra?: Record<string, any>;
}

// Truncation map for mapping LLM line numbers back to original content
interface TruncationMap {
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

// Truncation result
interface TruncationResult {
  content: string;
  truncation_map: TruncationMap;
  prompt_note: string;
}

// Request body interface
interface AnalyzeRequest {
  file_name?: string;
  file_type?: FileType;
  content: string;
  max_errors?: number;
  stream?: boolean;
}

// Parser hint interface
interface ParserHint {
  type: 'syntax_error' | 'structure_error' | 'warning';
  message: string;
  position?: number;
  line?: number;
  column?: number;
  row?: number;
  category?: string;
  extra?: Record<string, any>;
}

// Response interfaces
interface AnalyzeResponse {
  request_id: string;
  file_name?: string;
  file_type: FileType;
  detected_file_type?: FileType;
  is_structured: boolean;
  content_length: number;
  parser_hints?: ParserHint[];
  truncation_map?: TruncationMap;
  rag_snippets?: Array<{
    id: string;
    title: string;
    category: string;
  }>;
  llm_status?: string;
  cached?: boolean;
  cache_hit?: boolean;
  llm_parse_error?: string;
  raw_llm_output?: string;
  schema_validation_errors?: any[];
  errors: Array<{
    id?: string;
    line: number | null;
    column?: number | null;
    position?: number | null;
    message: string;
    type: 'error' | 'warning';
    category: string;
    severity?: 'critical' | 'high' | 'medium' | 'low';
    snippet?: string;
    position_note?: string;
    explanation?: string;
    confidence?: number;
    suggestions?: any[];
  }>;
  summary: {
    total_errors: number;
    total_warnings: number;
    analysis_time_ms: number;
    rag_loaded: boolean;
    llm_provider?: string;
    llm_model?: string;
    tokens_used?: number;
    sanity_checks_passed?: number;
    sanity_checks_failed?: number;
  };
}

interface ErrorResponse {
  error: true;
  message: string;
  statusCode: number;
  request_id?: string;
  details?: string;
  fix?: string;
}

/**
 * Detect file type using deterministic heuristics
 * Returns 'json' | 'csv' | 'xml' | 'yaml' | 'text'
 */
function detectFileType(content: string): Exclude<FileType, 'auto'> {
  // Trim leading whitespace for analysis
  const trimmed = content.trimStart();
  
  if (trimmed.length === 0) {
    return 'json';
  }

  const firstChar = trimmed[0];
  const firstLine = trimmed.split('\n')[0].trim();
  const firstTwoLines = trimmed.split('\n').slice(0, 2).map(l => l.trim());

  // JSON detection: starts with { or [
  if (firstChar === '{' || firstChar === '[') {
    return 'json';
  }

  // XML detection: starts with <?xml or first non-space char is <
  if (trimmed.startsWith('<?xml') || firstChar === '<') {
    return 'xml';
  }

  // YAML detection: check for key: value or - item patterns
  const yamlKeyValuePattern = /^[\w-]+\s*:\s*.+/;
  const yamlListPattern = /^\s*-\s+.+/;
  const yamlDocStart = /^---\s*$/;
  
  if (yamlDocStart.test(firstLine)) {
    return 'yaml';
  }

  // Check first two lines for YAML patterns
  let yamlPatternCount = 0;
  for (const line of firstTwoLines) {
    if (yamlKeyValuePattern.test(line) || yamlListPattern.test(line)) {
      yamlPatternCount++;
    }
  }
  if (yamlPatternCount >= 1) {
    return 'yaml';
  }

  // CSV detection: check for many commas and consistent row structure
  const lines = trimmed.split('\n').slice(0, 5).filter(l => l.trim().length > 0);
  
  if (lines.length >= 2) {
    const commaCount = lines[0].split(',').length;
    
    // If first line has at least 2 commas (3+ columns)
    if (commaCount >= 2) {
      let consistentRows = 0;
      
      for (let i = 1; i < Math.min(lines.length, 5); i++) {
        const currentCommaCount = lines[i].split(',').length;
        // Allow ±1 variance for flexibility
        if (Math.abs(currentCommaCount - commaCount) <= 1) {
          consistentRows++;
        }
      }
      
      // If at least 50% of rows have consistent comma count
      if (consistentRows >= Math.floor((lines.length - 1) / 2)) {
        return 'csv';
      }
    }
  }

  // Default to json
  return 'json';
}

/**
 * Check if file type is structured
 */
function isStructuredType(fileType: FileType): boolean {
  return ['json', 'csv', 'xml', 'yaml'].includes(fileType);
}

/**
 * Extract line and column from error message
 * Parses patterns like "position 123", "line 4 column 10", "at line 4", etc.
 */
function extractPositionFromError(errorMessage: string): {
  position?: number;
  line?: number;
  column?: number;
} {
  const result: { position?: number; line?: number; column?: number } = {};

  // Pattern: "position 123" or "at position 123"
  const positionMatch = errorMessage.match(/(?:at )?position\s+(\d+)/i);
  if (positionMatch) {
    result.position = parseInt(positionMatch[1], 10);
  }

  // Pattern: "line 4 column 10" or "line 4, column 10"
  const lineColMatch = errorMessage.match(/line\s+(\d+)[,\s]+column\s+(\d+)/i);
  if (lineColMatch) {
    result.line = parseInt(lineColMatch[1], 10);
    result.column = parseInt(lineColMatch[2], 10);
    return result;
  }

  // Pattern: "at line 4" or "line 4"
  const lineMatch = errorMessage.match(/(?:at )?line\s+(\d+)/i);
  if (lineMatch) {
    result.line = parseInt(lineMatch[1], 10);
  }

  // Pattern: "column 10" (standalone)
  const colMatch = errorMessage.match(/column\s+(\d+)/i);
  if (colMatch && !result.column) {
    result.column = parseInt(colMatch[1], 10);
  }

  return result;
}

/**
 * Fast local prechecks for JSON
 */
function precheckJson(content: string): ParserHint[] {
  const hints: ParserHint[] = [];

  try {
    JSON.parse(content);
    // Parse succeeded, no hints needed
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const position = extractPositionFromError(errorMessage);

    hints.push({
      type: 'syntax_error',
      message: `JSON parse error: ${errorMessage}`,
      ...position,
      extra: { parser: 'JSON.parse' },
    });
  }

  return hints.slice(0, 3); // Max 3 hints
}

/**
 * Fast local prechecks for CSV
 */
function precheckCsv(content: string): ParserHint[] {
  const hints: ParserHint[] = [];

  try {
    const records = parseCsv(content, {
      skip_empty_lines: false,
      relax_column_count: false, // Strict mode
      trim: false,
    });

    // If parsing succeeded with relax_column_count: false, rows are consistent
    // But let's still check for potential issues
    if (records.length > 0) {
      const expectedColumns = records[0].length;
      
      for (let i = 1; i < records.length; i++) {
        if (records[i].length !== expectedColumns) {
          hints.push({
            type: 'structure_error',
            message: `Row ${i + 1}: ${records[i].length} columns vs ${expectedColumns} expected`,
            row: i + 1,
            line: i + 1,
            extra: {
              expected_columns: expectedColumns,
              actual_columns: records[i].length,
            },
          });

          if (hints.length >= 3) break;
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Try to extract row/line information from error
    const rowMatch = errorMessage.match(/(?:row|line|record)\s+(\d+)/i);
    const hint: ParserHint = {
      type: 'syntax_error',
      message: `CSV parse error: ${errorMessage}`,
      extra: { parser: 'csv-parse' },
    };

    if (rowMatch) {
      hint.row = parseInt(rowMatch[1], 10);
      hint.line = parseInt(rowMatch[1], 10);
    }

    hints.push(hint);
  }

  return hints.slice(0, 3);
}

/**
 * Fast local prechecks for XML
 */
function precheckXml(content: string): ParserHint[] {
  const hints: ParserHint[] = [];

  try {
    // Use browser-compatible DOMParser in Node.js environment
    const { DOMParser } = require('@xmldom/xmldom');
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');

    // Check for parser errors
    const parserError = doc.getElementsByTagName('parsererror')[0];
    
    if (parserError) {
      const errorText = parserError.textContent || 'XML parsing error';
      const position = extractPositionFromError(errorText);

      hints.push({
        type: 'syntax_error',
        message: `XML parse error: ${errorText.trim()}`,
        ...position,
        extra: { parser: 'DOMParser' },
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    hints.push({
      type: 'syntax_error',
      message: `XML parse error: ${errorMessage}`,
      extra: { parser: 'xmldom' },
    });
  }

  return hints.slice(0, 3);
}

/**
 * Fast local prechecks for YAML
 */
function precheckYaml(content: string): ParserHint[] {
  const hints: ParserHint[] = [];

  try {
    yaml.load(content, { json: false });
    // Parse succeeded, no hints needed
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    
    const hint: ParserHint = {
      type: 'syntax_error',
      message: `YAML parse error: ${errorMessage}`,
      extra: { parser: 'js-yaml' },
    };

    // js-yaml provides mark with line and column
    if (error.mark) {
      hint.line = error.mark.line + 1; // js-yaml uses 0-based line numbers
      hint.column = error.mark.column + 1; // js-yaml uses 0-based column numbers
      hint.position = error.mark.position;
    }

    hints.push(hint);
  }

  return hints.slice(0, 3);
}

/**
 * Run fast local prechecks based on file type
 */
function runPrechecks(content: string, fileType: Exclude<FileType, 'auto'>): ParserHint[] {
  switch (fileType) {
    case 'json':
      return precheckJson(content);
    case 'csv':
      return precheckCsv(content);
    case 'xml':
      return precheckXml(content);
    case 'yaml':
      return precheckYaml(content);
    default:
      return []; // No prechecks for text
  }
}

/**
 * Extract error windows around parser error positions
 */
function extractErrorWindows(
  content: string,
  parserHints: ParserHint[],
  windowSize: number = ERROR_WINDOW_CHARS
): Array<{ start: number; end: number; reason: string; snippet: string }> {
  const windows: Array<{ start: number; end: number; reason: string; snippet: string }> = [];
  const usedRanges = new Set<string>();

  for (const hint of parserHints) {
    let position: number | undefined;

    // Determine position from hint
    if (hint.position !== undefined) {
      position = hint.position;
    } else if (hint.line !== undefined) {
      // Calculate position from line number
      const lines = content.split('\n');
      let charCount = 0;
      for (let i = 0; i < Math.min(hint.line - 1, lines.length); i++) {
        charCount += lines[i].length + 1; // +1 for newline
      }
      position = charCount;
    }

    if (position !== undefined) {
      // Create window around error position
      const start = Math.max(0, position - windowSize);
      const end = Math.min(content.length, position + windowSize);
      const rangeKey = `${start}-${end}`;

      // Avoid overlapping windows
      if (!usedRanges.has(rangeKey)) {
        usedRanges.add(rangeKey);
        windows.push({
          start,
          end,
          reason: `Error at ${hint.line ? `line ${hint.line}` : `position ${position}`}: ${hint.message.substring(0, 50)}`,
          snippet: content.substring(start, end),
        });
      }
    }
  }

  return windows;
}

/**
 * Truncate and chunk large content with smart sampling
 */
function truncateContent(
  content: string,
  parserHints: ParserHint[]
): TruncationResult {
  const originalLength = content.length;

  // If content is within safe limits, return as-is
  if (originalLength <= LLM_SAFE_CHARS) {
    return {
      content,
      truncation_map: {
        was_truncated: false,
        original_length: originalLength,
        truncated_length: originalLength,
        head_chars: originalLength,
        tail_chars: 0,
        error_windows: [],
        omitted_ranges: [],
      },
      prompt_note: '',
    };
  }

  // Extract head and tail
  const head = content.substring(0, HEAD_CHARS);
  const tail = content.substring(content.length - TAIL_CHARS);

  // Extract error windows from middle section
  const errorWindows = extractErrorWindows(content, parserHints);

  // Build truncated content
  let truncatedContent = head;
  const omittedRanges: Array<{ start: number; end: number }> = [];
  const errorWindowsInfo: Array<{ start: number; end: number; reason: string }> = [];

  // Add truncation marker
  truncatedContent += '\n\n...<TRUNCATED: Content omitted>...\n\n';

  // Add error windows if they exist and are not in head/tail
  for (const window of errorWindows) {
    // Skip if window overlaps with head or tail
    if (window.start < HEAD_CHARS || window.end > content.length - TAIL_CHARS) {
      continue;
    }

    truncatedContent += `\n\n...<ERROR CONTEXT at position ${window.start}>...\n`;
    truncatedContent += window.snippet;
    truncatedContent += `\n...<END ERROR CONTEXT>...\n\n`;

    errorWindowsInfo.push({
      start: window.start,
      end: window.end,
      reason: window.reason,
    });
  }

  // Add another truncation marker before tail
  if (errorWindows.length === 0) {
    truncatedContent += '\n\n...<TRUNCATED: Middle section omitted>...\n\n';
  }

  // Add tail
  truncatedContent += tail;

  // Calculate omitted ranges
  let lastIncluded = HEAD_CHARS;
  
  for (const window of errorWindowsInfo) {
    if (window.start > lastIncluded) {
      omittedRanges.push({
        start: lastIncluded,
        end: window.start,
      });
    }
    lastIncluded = window.end;
  }

  // Add final omitted range before tail
  const tailStart = content.length - TAIL_CHARS;
  if (lastIncluded < tailStart) {
    omittedRanges.push({
      start: lastIncluded,
      end: tailStart,
    });
  }

  const truncationMap: TruncationMap = {
    was_truncated: true,
    original_length: originalLength,
    truncated_length: truncatedContent.length,
    head_chars: HEAD_CHARS,
    tail_chars: TAIL_CHARS,
    error_windows: errorWindowsInfo,
    omitted_ranges: omittedRanges,
  };

  const promptNote = `
⚠️ IMPORTANT: This content has been truncated due to size (${originalLength} chars).

INCLUDED SECTIONS:
- HEAD: First ${HEAD_CHARS} characters
${errorWindowsInfo.length > 0 ? `- ERROR CONTEXTS: ${errorWindowsInfo.length} window(s) around detected errors` : ''}
- TAIL: Last ${TAIL_CHARS} characters

OMITTED: ${omittedRanges.map(r => `chars ${r.start}-${r.end}`).join(', ')}

INSTRUCTIONS FOR ANALYSIS:
1. Focus primarily on errors within the included sections
2. Line numbers may not be continuous due to truncation
3. If you reference line numbers, note they are from the truncated view
4. Errors in omitted sections cannot be detected - acknowledge this limitation
5. Prioritize errors found in the ERROR CONTEXT windows as they are known problem areas
`.trim();

  return {
    content: truncatedContent,
    truncation_map: truncationMap,
    prompt_note: promptNote,
  };
}

/**
 * Validate the analyze request body
 */
function validateAnalyzeRequest(body: any): {
  valid: boolean;
  error?: string;
  fix?: string;
  data?: AnalyzeRequest;
} {
  // Check if body exists
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: 'Request body is missing or invalid',
      fix: 'Send a JSON body with required fields: { content: "..." }',
    };
  }

  // Validate required field: content
  if (!body.content) {
    return {
      valid: false,
      error: 'Missing required field: content',
      fix: 'Add "content" field with the file content to analyze: { content: "your file content here" }',
    };
  }

  if (typeof body.content !== 'string') {
    return {
      valid: false,
      error: 'Invalid field type: content must be a string',
      fix: 'Ensure "content" is a string, not an object or array',
    };
  }

  if (body.content.trim().length === 0) {
    return {
      valid: false,
      error: 'Invalid field value: content cannot be empty',
      fix: 'Provide non-empty content to analyze',
    };
  }

  // Validate file_type if provided
  if (body.file_type !== undefined) {
    if (typeof body.file_type !== 'string') {
      return {
        valid: false,
        error: 'Invalid field type: file_type must be a string',
        fix: `Use one of: ${ALLOWED_FILE_TYPES.join(', ')}`,
      };
    }

    if (!ALLOWED_FILE_TYPES.includes(body.file_type as FileType)) {
      return {
        valid: false,
        error: `Invalid file_type: "${body.file_type}"`,
        fix: `Allowed values are: ${ALLOWED_FILE_TYPES.join(', ')}. Use "auto" for automatic detection.`,
      };
    }
  }

  // Validate file_name if provided
  if (body.file_name !== undefined && typeof body.file_name !== 'string') {
    return {
      valid: false,
      error: 'Invalid field type: file_name must be a string',
      fix: 'Provide a valid filename string, e.g., "data.json"',
    };
  }

  // Validate max_errors if provided
  if (body.max_errors !== undefined) {
    if (typeof body.max_errors !== 'number' || !Number.isInteger(body.max_errors)) {
      return {
        valid: false,
        error: 'Invalid field type: max_errors must be an integer',
        fix: 'Use a positive integer, e.g., max_errors: 10',
      };
    }

    if (body.max_errors < 1) {
      return {
        valid: false,
        error: 'Invalid field value: max_errors must be at least 1',
        fix: 'Use a positive integer for max_errors',
      };
    }

    if (body.max_errors > 1000) {
      return {
        valid: false,
        error: 'Invalid field value: max_errors cannot exceed 1000',
        fix: 'Reduce max_errors to 1000 or less',
      };
    }
  }

  // Validate stream if provided
  if (body.stream !== undefined && typeof body.stream !== 'boolean') {
    return {
      valid: false,
      error: 'Invalid field type: stream must be a boolean',
      fix: 'Use true or false for stream field',
    };
  }

  // All validations passed
  return {
    valid: true,
    data: {
      content: body.content,
      file_name: body.file_name,
      file_type: (body.file_type as FileType) || 'auto',
      max_errors: body.max_errors || 100,
      stream: body.stream || false,
    },
  };
}

/**
 * Main handler for /api/analyze
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const startTime = Date.now();
  const requestId = randomUUID();

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      const errorResponse: ErrorResponse = {
        error: true,
        message: 'Method not allowed',
        statusCode: 405,
        request_id: requestId,
        fix: 'Use POST method with JSON body',
      };
      res.status(405).json(errorResponse);
    }

    // Rate limiting check
    const rateLimitResult = rateLimiter.isAllowed(req);
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded for /api/analyze', {
        request_id: requestId,
        ipAddress: Logger.getClientIp(req),
        resetTime: new Date(rateLimitResult.resetTime).toISOString(),
      });

      const errorResponse: ErrorResponse = {
        error: true,
        message: 'Too many requests. Please try again later.',
        statusCode: 429,
        request_id: requestId,
        details: `Rate limit: ${rateLimitResult.remaining}/${20} requests remaining`,
        fix: `Wait ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)} seconds before retrying`,
      };

      res.setHeader('X-RateLimit-Limit', 20);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', rateLimitResult.resetTime);
      res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000));

      res.status(429).json(errorResponse);
    }

    // Content-Type validation
    const contentTypeResult = requestValidator.validateContentType(req, ['application/json']);
    if (!contentTypeResult.valid) {
      const errorResponse: ErrorResponse = {
        error: true,
        message: contentTypeResult.error!,
        statusCode: 400,
        request_id: requestId,
        fix: 'Set Content-Type header to application/json',
      };
      res.status(400).json(errorResponse);
    }

    // Request size validation (before parsing body)
    const sizeValidation = requestValidator.validateSize(req);
    if (!sizeValidation.valid) {
      logger.warn('Request size limit exceeded', {
        request_id: requestId,
        ipAddress: Logger.getClientIp(req),
        contentLength: req.headers['content-length'],
      });

      const errorResponse: ErrorResponse = {
        error: true,
        message: sizeValidation.error!,
        statusCode: 413,
        request_id: requestId,
        fix: 'Reduce file size or split into smaller chunks',
      };
      res.status(413).json(errorResponse);
    }

    // Validate request body structure and fields
    const bodyValidation = validateAnalyzeRequest(req.body);
    if (!bodyValidation.valid) {
      logger.info('Invalid request to /api/analyze', {
        request_id: requestId,
        ipAddress: Logger.getClientIp(req),
        error: bodyValidation.error,
      });

      const errorResponse: ErrorResponse = {
        error: true,
        message: bodyValidation.error!,
        statusCode: 400,
        request_id: requestId,
        fix: bodyValidation.fix,
      };
      res.status(400).json(errorResponse);
    }

    const requestData = bodyValidation.data!;

    // Compute content length
    const contentLength = requestData.content.length;

    // Validate content length against token limit
    const tokenValidation = requestValidator.validateTokenCount(requestData.content);
    if (!tokenValidation.valid) {
      logger.warn('Content exceeds token limit', {
        request_id: requestId,
        ipAddress: Logger.getClientIp(req),
        contentLength,
        estimatedTokens: Math.ceil(contentLength / 4),
      });

      const errorResponse: ErrorResponse = {
        error: true,
        message: tokenValidation.error!,
        statusCode: 413,
        request_id: requestId,
        fix: 'Reduce content size to under 16,000 characters (~4,000 tokens)',
      };
      res.status(413).json(errorResponse);
    }

    // Detect file type if 'auto'
    let detectedFileType: Exclude<FileType, 'auto'> | undefined;
    let finalFileType: Exclude<FileType, 'auto'>;

    if (requestData.file_type === 'auto') {
      detectedFileType = detectFileType(requestData.content);
      finalFileType = detectedFileType;
      
      logger.info('File type auto-detected', {
        request_id: requestId,
        detected_type: detectedFileType,
        content_preview: requestData.content.substring(0, 100),
      });
    } else {
      finalFileType = requestData.file_type as Exclude<FileType, 'auto'>;
    }

    // Check if structured
    const isStructured = isStructuredType(finalFileType);

    // Run fast local prechecks (synchronous, no LLM needed)
    const parserHints = runPrechecks(requestData.content, finalFileType);

    // Log precheck results
    if (parserHints.length > 0) {
      logger.info('Precheck detected issues', {
        request_id: requestId,
        file_type: finalFileType,
        hints_count: parserHints.length,
        hints: parserHints,
      });
    }

    // Apply truncation/sampling strategy for large files
    const truncationResult = truncateContent(requestData.content, parserHints);

    // Log truncation info
    if (truncationResult.truncation_map.was_truncated) {
      logger.info('Content truncated for LLM processing', {
        request_id: requestId,
        original_length: truncationResult.truncation_map.original_length,
        truncated_length: truncationResult.truncation_map.truncated_length,
        error_windows: truncationResult.truncation_map.error_windows.length,
        omitted_ranges: truncationResult.truncation_map.omitted_ranges.length,
      });
    }

    // Retrieve RAG snippets for grounding
    const errorContext = parserHints.map(h => h.message).join(' ');
    const ragSnippets = retrieveRAGSnippets(finalFileType, errorContext, 3);
    const ragPromptSection = formatRAGSnippetsForPrompt(ragSnippets);

    // Log RAG retrieval
    logger.info('RAG snippets retrieved', {
      request_id: requestId,
      file_type: finalFileType,
      snippets_count: ragSnippets.length,
      snippet_ids: ragSnippets.map(s => s.id),
    });

    // Log successful validation
    logger.info('Request validated successfully', {
      request_id: requestId,
      ipAddress: Logger.getClientIp(req),
      file_name: requestData.file_name,
      file_type: requestData.file_type,
      detected_file_type: detectedFileType,
      final_file_type: finalFileType,
      is_structured: isStructured,
      content_length: contentLength,
      max_errors: requestData.max_errors,
      stream: requestData.stream,
    });

    // Add rate limit headers
    const stats = rateLimiter.getStats(req);
    res.setHeader('X-RateLimit-Limit', stats.limit);
    res.setHeader('X-RateLimit-Remaining', stats.remaining);
    res.setHeader('X-RateLimit-Reset', stats.resetTime);
    res.setHeader('X-Request-ID', requestId);

    // Check cache before calling LLM (cost optimization)
    const contentHash = computeContentHash(requestData.content);
    const cachedResult = await getCachedAnalysis(
      requestData.content,
      requestData.max_errors || 100,
      finalFileType,
      requestId
    );

    if (cachedResult) {
      // Cache hit! Return cached response
      logger.info('Returning cached analysis result', {
        request_id: requestId,
        content_hash: contentHash,
        file_type: finalFileType,
        max_errors: requestData.max_errors,
      });

      res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
      res.setHeader('X-Cache-Status', 'HIT');
      res.setHeader('X-Content-Hash', contentHash);
      
      // Log telemetry for cache hit
      logTelemetryAsync({
        request_id: requestId,
        timestamp: new Date().toISOString(),
        file_type: finalFileType,
        content_length: contentLength,
        was_truncated: false,
        max_errors_requested: requestData.max_errors,
        latency_ms: Date.now() - startTime,
        cache_hit: true,
        total_errors: cachedResult.summary.total_errors || 0,
        total_warnings: cachedResult.summary.total_warnings || 0,
        success: true,
      });
      
      res.status(200).json(cachedResult);
    }

    logger.debug('Cache miss - proceeding with LLM analysis', {
      request_id: requestId,
      content_hash: contentHash,
    });

    // Call LLM for error analysis
    let llmResponse;
    try {
      llmResponse = await callLLM({
        fileType: finalFileType,
        content: truncationResult.content,
        originalContent: requestData.content,  // Pass original content for position mapping
        fileName: requestData.file_name,
        parserHints,
        ragSnippets,
        truncationMap: truncationResult.truncation_map,
        truncationNote: truncationResult.prompt_note,
        maxErrors: requestData.max_errors,
        stream: requestData.stream,
        requestId,
      });
    } catch (llmError) {
      // Check if this is a parse error with structured data
      let parseErrorData: any = null;
      if (llmError instanceof Error) {
        try {
          parseErrorData = JSON.parse(llmError.message);
        } catch {
          // Not a structured error, continue with generic handling
        }
      }

      // Get RAG status for response
      const ragStatus = getRAGStatus();
      const providerInfo = getProviderInfo();

      if (parseErrorData && parseErrorData.type === 'llm_parse_error') {
        // LLM returned unparseable JSON - return parse error with raw output and parserHints
        logger.error('LLM parse error - returning parserHints as fallback', undefined, {
          request_id: requestId,
          parse_error: parseErrorData.message,
          raw_output_length: parseErrorData.raw_llm_output?.length,
          precheck_hints: parserHints.length,
        });

        // Convert parserHints to error format for fallback
        const fallbackErrors = parserHints.map((hint, idx) => ({
          line: hint.line || 1,
          column: hint.column,
          message: hint.message,
          type: 'error' as const,
          category: hint.category || 'syntax',
          severity: 'medium' as const,
        }));

        const parseErrorResponse: AnalyzeResponse = {
          request_id: requestId,
          file_name: requestData.file_name,
          file_type: finalFileType,
          ...(detectedFileType && { detected_file_type: detectedFileType }),
          is_structured: isStructured,
          content_length: contentLength,
          parser_hints: parserHints,
          ...(truncationResult.truncation_map.was_truncated && { 
            truncation_map: truncationResult.truncation_map 
          }),
          ...(ragSnippets.length > 0 && {
            rag_snippets: ragSnippets.map(s => ({
              id: s.id,
              title: s.title,
              category: s.category,
            })),
          }),
          errors: fallbackErrors,
          summary: {
            total_errors: fallbackErrors.length,
            total_warnings: 0,
            analysis_time_ms: Date.now() - startTime,
            rag_loaded: ragStatus.loaded,
          },
          llm_status: 'parse_error' as any,
          llm_parse_error: parseErrorData.message,
          raw_llm_output: parseErrorData.raw_llm_output,
        };

        res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
        res.setHeader('X-LLM-Status', 'parse-error');
        res.setHeader('X-Fallback-Mode', 'prechecks-only');
        res.status(200).json(parseErrorResponse);
      }

      if (parseErrorData && parseErrorData.type === 'schema_validation_error') {
        // LLM returned valid JSON but schema validation failed
        logger.error('LLM schema validation error - returning parserHints as fallback', undefined, {
          request_id: requestId,
          validation_errors: parseErrorData.validation_errors,
          precheck_hints: parserHints.length,
        });

        const fallbackErrors = parserHints.map((hint, idx) => ({
          line: hint.line || 1,
          column: hint.column,
          message: hint.message,
          type: 'error' as const,
          category: hint.category || 'syntax',
          severity: 'medium' as const,
        }));

        const validationErrorResponse: AnalyzeResponse = {
          request_id: requestId,
          file_name: requestData.file_name,
          file_type: finalFileType,
          ...(detectedFileType && { detected_file_type: detectedFileType }),
          is_structured: isStructured,
          content_length: contentLength,
          parser_hints: parserHints,
          ...(truncationResult.truncation_map.was_truncated && { 
            truncation_map: truncationResult.truncation_map 
          }),
          ...(ragSnippets.length > 0 && {
            rag_snippets: ragSnippets.map(s => ({
              id: s.id,
              title: s.title,
              category: s.category,
            })),
          }),
          errors: fallbackErrors,
          summary: {
            total_errors: fallbackErrors.length,
            total_warnings: 0,
            analysis_time_ms: Date.now() - startTime,
            rag_loaded: ragStatus.loaded,
          },
          llm_status: 'validation_error' as any,
          schema_validation_errors: parseErrorData.validation_errors,
        };

        res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
        res.setHeader('X-LLM-Status', 'validation-error');
        res.setHeader('X-Fallback-Mode', 'prechecks-only');
        res.status(200).json(validationErrorResponse);
      }

      // Generic LLM error - rethrow to be handled by outer catch
      throw llmError;
    }

    // Get RAG status for response
    const ragStatus = getRAGStatus();
    const providerInfo = getProviderInfo();

    // Check if LLM call succeeded
    if (llmResponse.success && llmResponse.data) {
      // LLM analysis succeeded
      const response: AnalyzeResponse = {
        request_id: requestId,
        file_name: requestData.file_name,
        file_type: finalFileType,
        ...(detectedFileType && { detected_file_type: detectedFileType }),
        is_structured: isStructured,
        content_length: contentLength,
        ...(parserHints.length > 0 && { parser_hints: parserHints }),
        ...(truncationResult.truncation_map.was_truncated && { 
          truncation_map: truncationResult.truncation_map 
        }),
        ...(ragSnippets.length > 0 && {
          rag_snippets: ragSnippets.map(s => ({
            id: s.id,
            title: s.title,
            category: s.category,
          })),
        }),
        errors: llmResponse.data.errors.map(err => ({
          id: err.id,
          line: err.line,
          column: err.column,
          message: err.message,
          type: err.type,
          category: err.category,
          severity: err.severity,
          explanation: err.explanation,
          confidence: err.confidence,
          suggestions: err.suggestions,
          ...(err.snippet && { snippet: err.snippet }),
          ...(err.position_note && { position_note: err.position_note }),
        })),
        summary: {
          total_errors: llmResponse.data.total_errors,
          total_warnings: llmResponse.data.errors.filter(e => e.type === 'warning').length,
          analysis_time_ms: Date.now() - startTime,
          rag_loaded: ragStatus.loaded,
          ...(llmResponse.sanity_checks_passed !== undefined && {
            sanity_checks_passed: llmResponse.sanity_checks_passed,
            sanity_checks_failed: llmResponse.sanity_checks_failed,
          }),
        },
      };

      // Cache successful analysis result (asynchronously, don't wait)
      cacheAnalysisResult(
        requestData.content,
        requestData.max_errors || 100,
        finalFileType,
        response,
        requestId,
        providerInfo.model
      ).catch(err => {
        logger.warn('Failed to cache analysis result', {
          request_id: requestId,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      // Log successful completion
      logger.info('Analysis completed successfully', {
        request_id: requestId,
        provider: providerInfo.provider,
        model: providerInfo.model,
        errors_found: llmResponse.data.total_errors,
        warnings_found: llmResponse.data.errors.filter(e => e.type === 'warning').length,
        sanity_checks_passed: llmResponse.sanity_checks_passed,
        sanity_checks_failed: llmResponse.sanity_checks_failed,
        latency: Date.now() - startTime,
        llm_latency: llmResponse.latency_ms,
        tokens_used: llmResponse.usage?.total_tokens,
        retries: llmResponse.retries,
      });

      res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
      res.setHeader('X-Cache-Status', 'MISS');
      res.setHeader('X-Content-Hash', contentHash);
      res.setHeader('X-LLM-Provider', providerInfo.provider);
      res.setHeader('X-LLM-Model', providerInfo.model);
      if (llmResponse.usage) {
        res.setHeader('X-LLM-Tokens', llmResponse.usage.total_tokens);
      }

      // Log telemetry for successful analysis
      logTelemetryAsync({
        request_id: requestId,
        timestamp: new Date().toISOString(),
        file_type: finalFileType,
        content_length: contentLength,
        was_truncated: truncationResult.truncation_map.was_truncated,
        max_errors_requested: requestData.max_errors,
        llm_provider: providerInfo.provider,
        llm_model: providerInfo.model,
        tokens_used: llmResponse.usage?.total_tokens,
        latency_ms: Date.now() - startTime,
        cache_hit: false,
        total_errors: response.summary.total_errors,
        total_warnings: response.summary.total_warnings,
        success: true,
        sanity_checks_passed: llmResponse.sanity_checks_passed,
        sanity_checks_failed: llmResponse.sanity_checks_failed,
        rag_snippets_used: ragSnippets.length,
        user_agent: req.headers['user-agent'],
      });

      res.status(200).json(response);
    } else {
      // LLM call failed with generic error, return prechecks as fallback
      logger.warn('LLM call failed, returning precheck results as fallback', {
        request_id: requestId,
        llm_error: llmResponse.error,
        retries: llmResponse.retries,
      });
      // Fallback response with prechecks only
      const fallbackResponse: AnalyzeResponse = {
        request_id: requestId,
        file_name: requestData.file_name,
        file_type: finalFileType,
        ...(detectedFileType && { detected_file_type: detectedFileType }),
        is_structured: isStructured,
        content_length: contentLength,
        ...(parserHints.length > 0 && { parser_hints: parserHints }),
        ...(truncationResult.truncation_map.was_truncated && { 
          truncation_map: truncationResult.truncation_map 
        }),
        ...(ragSnippets.length > 0 && {
          rag_snippets: ragSnippets.map(s => ({
            id: s.id,
            title: s.title,
            category: s.category,
          })),
        }),
        errors: [],
        summary: {
          total_errors: 0,
          total_warnings: 0,
          analysis_time_ms: Date.now() - startTime,
          rag_loaded: ragStatus.loaded,
        },
      };

      // Log completion with fallback
      const latency = Date.now() - startTime;
      logger.info('Analysis completed with fallback (prechecks only)', {
        request_id: requestId,
        latency,
        llm_error: llmResponse.error,
        precheck_hints: parserHints.length,
        ipAddress: Logger.getClientIp(req),
      });

      res.setHeader('X-Response-Time', `${latency}ms`);
      res.setHeader('X-LLM-Status', 'failed');
      res.setHeader('X-Fallback-Mode', 'prechecks-only');
      
      // Log telemetry for failed LLM call with fallback
      logTelemetryAsync({
        request_id: requestId,
        timestamp: new Date().toISOString(),
        file_type: finalFileType,
        content_length: contentLength,
        was_truncated: truncationResult.truncation_map.was_truncated,
        max_errors_requested: requestData.max_errors,
        llm_provider: providerInfo.provider,
        llm_model: providerInfo.model,
        latency_ms: latency,
        cache_hit: false,
        total_errors: 0,
        total_warnings: 0,
        success: false,
        error_type: 'llm_failure',
        rag_snippets_used: ragSnippets.length,
        user_agent: req.headers['user-agent'],
      });
      
      res.status(200).json(fallbackResponse);
    }

  } catch (error) {
    const latency = Date.now() - startTime;

    logger.error(
      'Unexpected error in /api/analyze',
      error instanceof Error ? error : new Error(String(error)),
      {
        request_id: requestId,
        latency,
        ipAddress: Logger.getClientIp(req),
      }
    );

    const errorResponse: ErrorResponse = {
      error: true,
      message: 'Internal server error',
      statusCode: 500,
      request_id: requestId,
      fix: 'Please try again later or contact support if the issue persists',
    };

    // Log telemetry for error case
    logTelemetryAsync({
      request_id: requestId,
      timestamp: new Date().toISOString(),
      file_type: 'unknown',
      content_length: 0,
      was_truncated: false,
      latency_ms: latency,
      cache_hit: false,
      total_errors: 0,
      total_warnings: 0,
      success: false,
      error_type: 'internal_error',
      user_agent: req.headers['user-agent'],
    });

    res.status(500).json(errorResponse);
  }
}


