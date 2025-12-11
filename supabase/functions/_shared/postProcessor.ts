/**
 * Post-Processing: Safety, Heuristics & Normalization
 * 
 * This module performs final validation and enhancement of LLM responses:
 * - Normalizes suggestions (text, safety, preview)
 * - Evaluates safety heuristically if not provided
 * - Normalizes confidence values (percentage strings → floats)
 * - Performs sanity checks (simulated apply & parse)
 * - Generates unique error IDs
 * - Adds analysis timing metadata
 */

import { parse as parseCSV } from 'csv-parse/sync';
import { DOMParser } from '@xmldom/xmldom';
import * as yaml from 'js-yaml';

// ============================================================================
// Types
// ============================================================================

export interface NormalizedSuggestion {
  description: string;
  safety: 'safe' | 'risky' | 'manual_review';
  fix_code?: string;
  preview?: string;  // Exact replacement snippet
}

export interface NormalizedError {
  id: string;  // Unique error ID
  line: number | null;
  column?: number | null;
  position?: number | null;
  message: string;
  type: 'error' | 'warning';
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  explanation: string;
  confidence: number;  // Normalized to 0.0-1.0
  suggestions: NormalizedSuggestion[];
  snippet?: string;
  position_note?: string;  // Explanation if position is truncation-aware
  sanity_check_passed?: boolean;  // Internal flag for sanity checking
}

export interface PostProcessResult {
  errors: NormalizedError[];
  total_errors: number;
  analysis_confidence: number;
  analysis_time_ms: number;
  sanity_checks_passed?: number;
  sanity_checks_failed?: number;
}

// ============================================================================
// Confidence Normalization
// ============================================================================

/**
 * Normalize confidence to 0.0-1.0 float
 * Handles: 0.95, "0.95", "95%", "95", 95
 */
export function normalizeConfidence(confidence: any): number {
  if (typeof confidence === 'number') {
    // Already a number - clamp to [0, 1]
    if (confidence >= 0 && confidence <= 1) {
      return confidence;
    }
    // Percentage as number (95 → 0.95)
    if (confidence > 1 && confidence <= 100) {
      return confidence / 100;
    }
    // Out of range - return 0.5
    return 0.5;
  }

  if (typeof confidence === 'string') {
    // Remove whitespace
    const trimmed = confidence.trim();

    // Handle percentage strings: "95%", "95 %"
    if (trimmed.endsWith('%')) {
      const num = parseFloat(trimmed.replace('%', '').trim());
      if (!isNaN(num) && num >= 0 && num <= 100) {
        return num / 100;
      }
    }

    // Handle numeric strings: "0.95", "95"
    const num = parseFloat(trimmed);
    if (!isNaN(num)) {
      if (num >= 0 && num <= 1) {
        return num;
      }
      if (num > 1 && num <= 100) {
        return num / 100;
      }
    }
  }

  // Default fallback
  return 0.5;
}

// ============================================================================
// Safety Heuristics
// ============================================================================

/**
 * Evaluate suggestion safety heuristically if not provided
 */
export function evaluateSafetyHeuristic(
  description: string,
  fixCode?: string
): 'safe' | 'risky' | 'manual_review' {
  const lower = description.toLowerCase();
  const code = (fixCode || '').toLowerCase();

  // SAFE patterns (simple, reversible changes)
  const safePatterns = [
    // Punctuation fixes
    /add\s+(comma|semicolon|colon|bracket|brace|parenthesis|quote)/i,
    /insert\s+(,|;|:|{|}|\[|\]|\(|\)|"|')/,
    /missing\s+(comma|semicolon|bracket|brace|quote)/i,
    
    // Simple removals
    /remove\s+(trailing\s+)?(comma|semicolon)/i,
    /delete\s+(extra|duplicate)\s+(comma|brace|bracket)/i,
    
    // Whitespace/formatting
    /fix\s+(indentation|whitespace|spacing)/i,
    /add\s+(newline|line\s+break)/i,
    /remove\s+(extra\s+)?(whitespace|spaces|tabs)/i,
    
    // Quote fixes
    /add\s+(closing|opening)\s+quote/i,
    /escape\s+quote/i,
    /change\s+(single|double)\s+quote/i,
  ];

  // Check if code is simple single-character insertion
  if (fixCode && fixCode.length <= 3) {
    const singleChars = [',', ';', ':', '{', '}', '[', ']', '(', ')', '"', "'", '\n'];
    if (singleChars.some(char => fixCode.trim() === char)) {
      return 'safe';
    }
  }

  // Check safe patterns
  if (safePatterns.some(pattern => pattern.test(description))) {
    return 'safe';
  }

  // RISKY patterns (data loss, complex changes)
  const riskyPatterns = [
    // Data removal
    /remove\s+(field|property|key|value|data|content|line|row|column)/i,
    /delete\s+(field|property|key|value|data|content|line|row)/i,
    
    // Structural changes
    /restructure|reorganize|rewrite|refactor/i,
    /change\s+(structure|format|schema|type)/i,
    /convert\s+(to|from)\s+(array|object|string|number)/i,
    
    // Multiple operations
    /and\s+(also\s+)?(remove|delete|change|modify)/i,
    /first.*then/i,
    
    // Vague suggestions
    /fix\s+all|correct\s+everything|repair\s+entire/i,
  ];

  // Check risky patterns
  if (riskyPatterns.some(pattern => pattern.test(description))) {
    return 'risky';
  }

  // MANUAL_REVIEW patterns (complex but not clearly risky)
  const manualReviewPatterns = [
    /validate|verify|check|review|confirm/i,
    /may\s+need|might\s+need|consider|should\s+consider/i,
    /depending\s+on|if\s+you\s+want|optionally/i,
  ];

  if (manualReviewPatterns.some(pattern => pattern.test(description))) {
    return 'manual_review';
  }

  // Default: manual review for safety
  return 'manual_review';
}

/**
 * Generate preview of suggestion application
 */
export function generateSuggestionPreview(
  description: string,
  fixCode?: string,
  context?: string
): string | undefined {
  if (!fixCode) return undefined;

  // If fix code is short, show it directly
  if (fixCode.length <= 50) {
    return fixCode;
  }

  // For longer fixes, show truncated version
  const truncated = fixCode.substring(0, 47) + '...';
  return truncated;
}

// ============================================================================
// Sanity Checking (Simulated Apply & Parse)
// ============================================================================

/**
 * Apply suggestion to content at specified line/position
 */
function applySuggestion(
  content: string,
  line: number | null,
  column: number | null,
  fixCode: string,
  description: string
): string | null {
  try {
    const lines = content.split('\n');

    // Handle line-based suggestions
    if (line !== null && line >= 1 && line <= lines.length) {
      const lineIndex = line - 1;
      const originalLine = lines[lineIndex];

      // Determine operation type from description
      const lower = description.toLowerCase();

      // INSERTION at end of line
      if (/add.*at\s+end|append|insert.*after/i.test(lower)) {
        lines[lineIndex] = originalLine + fixCode;
        return lines.join('\n');
      }

      // INSERTION at beginning of line
      if (/add.*at\s+start|prepend|insert.*before/i.test(lower)) {
        lines[lineIndex] = fixCode + originalLine;
        return lines.join('\n');
      }

      // INSERTION at column position
      if (column !== null && column >= 1) {
        const colIndex = Math.min(column - 1, originalLine.length);
        lines[lineIndex] = 
          originalLine.substring(0, colIndex) + 
          fixCode + 
          originalLine.substring(colIndex);
        return lines.join('\n');
      }

      // REPLACEMENT of entire line
      if (/replace.*line|change.*line/i.test(lower)) {
        lines[lineIndex] = fixCode;
        return lines.join('\n');
      }

      // Default: append to line
      lines[lineIndex] = originalLine + fixCode;
      return lines.join('\n');
    }

    // Cannot apply without valid line number
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Validate content after applying suggestion
 */
function validateContent(content: string, fileType: string): boolean {
  try {
    switch (fileType.toLowerCase()) {
      case 'json':
        JSON.parse(content);
        return true;

      case 'csv':
        parseCSV(content, { 
          skip_empty_lines: true,
          relax_quotes: true,
        });
        return true;

      case 'xml':
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/xml');
        // Check for parse errors
        const parseError = doc.getElementsByTagName('parsererror');
        return parseError.length === 0;

      case 'yaml':
      case 'yml':
        yaml.load(content);
        return true;

      default:
        // Unknown file type - cannot validate
        return false;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Perform sanity check: simulate apply & validate
 */
export function performSanityCheck(
  content: string,
  fileType: string,
  error: any
): {
  passed: boolean;
  adjustedSafety?: 'safe' | 'risky' | 'manual_review';
  confidenceMultiplier: number;
  note?: string;
} {
  // Need at least one suggestion with fix_code
  if (!error.suggestions || error.suggestions.length === 0) {
    return { passed: false, confidenceMultiplier: 1.0 };
  }

  const suggestion = error.suggestions[0];
  if (!suggestion.fix_code) {
    return { passed: false, confidenceMultiplier: 1.0 };
  }

  // Apply suggestion
  const modified = applySuggestion(
    content,
    error.line,
    error.column,
    suggestion.fix_code,
    suggestion.description
  );

  if (!modified) {
    return {
      passed: false,
      adjustedSafety: 'risky',
      confidenceMultiplier: 0.8,
      note: 'Could not simulate suggestion application',
    };
  }

  // Validate modified content
  const isValid = validateContent(modified, fileType);

  if (isValid) {
    // Success! Suggestion produces valid output
    return {
      passed: true,
      adjustedSafety: 'safe',
      confidenceMultiplier: 1.2,  // Boost confidence
      note: 'Sanity check passed: suggestion produces valid output',
    };
  } else {
    // Failure: suggestion produces invalid output
    return {
      passed: false,
      adjustedSafety: 'risky',
      confidenceMultiplier: 0.6,  // Lower confidence
      note: 'Sanity check failed: suggestion produces invalid output',
    };
  }
}

// ============================================================================
// Suggestion Normalization
// ============================================================================

/**
 * Normalize a single suggestion
 */
export function normalizeSuggestion(
  suggestion: any,
  content: string,
  fileType: string,
  error: any
): NormalizedSuggestion {
  const description = suggestion.description || suggestion.text || 'No description provided';
  const fixCode = suggestion.fix_code || suggestion.code;
  
  // Determine safety
  let safety: 'safe' | 'risky' | 'manual_review';
  
  if (suggestion.safety && ['safe', 'risky', 'manual_review'].includes(suggestion.safety)) {
    safety = suggestion.safety;
  } else {
    // Evaluate heuristically
    safety = evaluateSafetyHeuristic(description, fixCode);
  }

  // Generate preview
  const preview = generateSuggestionPreview(description, fixCode, error.snippet);

  return {
    description,
    safety,
    ...(fixCode && { fix_code: fixCode }),
    ...(preview && { preview }),
  };
}

// ============================================================================
// Error Normalization
// ============================================================================

/**
 * Generate unique error ID
 */
function generateErrorId(error: any, index: number): string {
  const category = error.category || 'unknown';
  const line = error.line || 0;
  const col = error.column || 0;
  
  // Format: category_line_col_index
  return `${category}_${line}_${col}_${index}`;
}

/**
 * Normalize a single error with sanity checking
 */
export function normalizeError(
  error: any,
  index: number,
  content: string,
  fileType: string,
  enableSanityCheck: boolean
): NormalizedError & { sanity_check_passed?: boolean } {
  // Normalize confidence
  const baseConfidence = normalizeConfidence(error.confidence);

  // Normalize suggestions
  const normalizedSuggestions = (error.suggestions || []).map((sug: any) =>
    normalizeSuggestion(sug, content, fileType, error)
  );

  // Perform sanity check if enabled and we have a fixable suggestion
  let sanityCheck: ReturnType<typeof performSanityCheck> | null = null;
  if (
    enableSanityCheck && 
    normalizedSuggestions.length > 0 && 
    normalizedSuggestions[0].fix_code
  ) {
    sanityCheck = performSanityCheck(content, fileType, {
      ...error,
      suggestions: normalizedSuggestions,
    });

    // Apply sanity check adjustments
    if (sanityCheck.adjustedSafety) {
      normalizedSuggestions[0].safety = sanityCheck.adjustedSafety;
    }
  }

  // Calculate final confidence
  const finalConfidence = sanityCheck
    ? Math.min(baseConfidence * sanityCheck.confidenceMultiplier, 1.0)
    : baseConfidence;

  // Build normalized error
  const normalized: NormalizedError & { sanity_check_passed?: boolean } = {
    id: generateErrorId(error, index),
    line: error.line || null,
    ...(error.column !== undefined && { column: error.column }),
    ...(error.position !== undefined && { position: error.position }),
    message: error.message || 'Unknown error',
    type: error.type || 'error',
    category: error.category || 'syntax',
    severity: error.severity || 'medium',
    explanation: error.explanation || error.message || 'No explanation provided',
    confidence: finalConfidence,
    suggestions: normalizedSuggestions,
    ...(error.snippet && { snippet: error.snippet }),
    ...(error.position_note && { position_note: error.position_note }),
  };

  // Add sanity check note if available
  if (sanityCheck?.note) {
    normalized.position_note = normalized.position_note
      ? `${normalized.position_note}; ${sanityCheck.note}`
      : sanityCheck.note;
  }

  if (sanityCheck) {
    normalized.sanity_check_passed = sanityCheck.passed;
  }

  return normalized;
}

// ============================================================================
// Main Post-Processing Function
// ============================================================================

/**
 * Post-process LLM response with normalization and sanity checking
 */
export function postProcessResponse(
  response: any,
  content: string,
  fileType: string,
  startTime: number,
  options: {
    enableSanityCheck?: boolean;
  } = {}
): PostProcessResult {
  const enableSanityCheck = options.enableSanityCheck !== false;

  // Normalize all errors
  const normalizedErrors = (response.errors || []).map((error: any, index: number) =>
    normalizeError(error, index, content, fileType, enableSanityCheck)
  );

  // Calculate sanity check stats
  const sanityCheckedErrors = normalizedErrors.filter(
    (e: NormalizedError) => e.sanity_check_passed !== undefined
  );
  const sanityChecksPassed = sanityCheckedErrors.filter(
    (e: NormalizedError) => e.sanity_check_passed === true
  ).length;
  const sanityChecksFailed = sanityCheckedErrors.filter(
    (e: NormalizedError) => e.sanity_check_passed === false
  ).length;

  // Remove sanity_check_passed from final output (internal only)
  const finalErrors = normalizedErrors.map(({ sanity_check_passed, ...error }: NormalizedError) => error);

  // Normalize analysis confidence
  const analysisConfidence = normalizeConfidence(
    response.analysis_confidence || response.confidence || 0.5
  );

  // Calculate analysis time
  const analysisTimeMs = Date.now() - startTime;

  return {
    errors: finalErrors,
    total_errors: finalErrors.filter((e: any) => e.type === 'error').length,
    analysis_confidence: analysisConfidence,
    analysis_time_ms: analysisTimeMs,
    ...(sanityCheckedErrors.length > 0 && {
      sanity_checks_passed: sanityChecksPassed,
      sanity_checks_failed: sanityChecksFailed,
    }),
  };
}

// ============================================================================
// Batch Post-Processing
// ============================================================================

/**
 * Post-process multiple responses (for streaming or batch analysis)
 */
export function postProcessBatch(
  responses: any[],
  content: string,
  fileType: string,
  startTime: number,
  options: {
    enableSanityCheck?: boolean;
  } = {}
): PostProcessResult[] {
  return responses.map(response =>
    postProcessResponse(response, content, fileType, startTime, options)
  );
}

// ============================================================================
// Exports
// ============================================================================

export default {
  normalizeConfidence,
  evaluateSafetyHeuristic,
  generateSuggestionPreview,
  performSanityCheck,
  normalizeSuggestion,
  normalizeError,
  postProcessResponse,
  postProcessBatch,
};

