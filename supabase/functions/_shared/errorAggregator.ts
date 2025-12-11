/**
 * Error Aggregation - Merge, deduplicate, and normalize errors across chunks
 */

export interface DetectedError {
  id: string;
  type: 'syntax' | 'semantic' | 'structural' | 'format';
  line: number;
  column?: number;
  message: string;
  explanation: string;
  confidence: number; // 0.0 - 1.0
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestions: Array<{
    text: string;
    safety: 'safe' | 'risky' | 'manual_review';
  }>;
  sources: string[]; // Which chunks detected this
}

export interface AggregationResult {
  errors: DetectedError[];
  totalSyntaxErrors: number;
  totalSemanticErrors: number;
  totalWarnings: number;
  deduplicationStats: {
    mergedCount: number;
    totalOriginal: number;
  };
}

/**
 * Check if two errors are similar (within same location range and message)
 */
function areSimilarErrors(
  err1: DetectedError,
  err2: DetectedError,
  lineTolerance: number = 2
): boolean {
  // Must be within 2 lines
  if (Math.abs(err1.line - err2.line) > lineTolerance) return false;
  
  // Similar messages (first 40 chars)
  const msg1 = err1.message.slice(0, 40).toLowerCase();
  const msg2 = err2.message.slice(0, 40).toLowerCase();
  
  return msg1 === msg2 || msg1.includes(msg2) || msg2.includes(msg1);
}

/**
 * Merge two similar errors
 */
function mergeErrors(errors: DetectedError[]): DetectedError[] {
  const merged: DetectedError[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < errors.length; i++) {
    if (used.has(i)) continue;
    
    const current = errors[i];
    const similar = [i];
    
    // Find all similar errors
    for (let j = i + 1; j < errors.length; j++) {
      if (used.has(j)) continue;
      if (areSimilarErrors(current, errors[j])) {
        similar.push(j);
      }
    }
    
    if (similar.length === 1) {
      // No duplicates
      merged.push(current);
      used.add(i);
    } else {
      // Merge all similar errors
      const merged_error: DetectedError = {
        ...current,
        id: `merged-${current.id}`,
        // Average confidence
        confidence:
          similar.reduce((sum, idx) => sum + errors[idx].confidence, 0) / similar.length,
        // Combine sources
        sources: Array.from(
          new Set(similar.flatMap(idx => errors[idx].sources))
        ),
        // Use highest severity
        severity: (['critical', 'high', 'medium', 'low'] as const).find(sev =>
          similar.some(idx => errors[idx].severity === sev)
        ) || 'medium',
      };
      
      merged.push(merged_error);
      similar.forEach(idx => used.add(idx));
    }
  }
  
  return merged;
}

/**
 * Aggregate errors from multiple chunks
 */
export function aggregateChunkErrors(
  errorsByChunk: Array<{
    chunkId: string;
    errors: DetectedError[];
  }>
): AggregationResult {
  // Flatten and normalize all errors
  const allErrors: DetectedError[] = [];
  
  for (const { chunkId, errors } of errorsByChunk) {
    for (const error of errors) {
      allErrors.push({
        ...error,
        id: `${chunkId}-${error.id}`,
        sources: [...(error.sources || []), chunkId],
      });
    }
  }
  
  // Merge similar errors
  const merged = mergeErrors(allErrors);
  
  // Sort by severity, then confidence, then line
  merged.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    return a.line - b.line;
  });
  
  // Count by type
  const syntaxErrors = merged.filter(e => e.type === 'syntax').length;
  const semanticErrors = merged.filter(e => e.type === 'semantic').length;
  const warnings = merged.filter(e => e.severity === 'low').length;
  
  return {
    errors: merged,
    totalSyntaxErrors: syntaxErrors,
    totalSemanticErrors: semanticErrors,
    totalWarnings: warnings,
    deduplicationStats: {
      mergedCount: merged.length,
      totalOriginal: allErrors.length,
    },
  };
}

/**
 * Validate and apply fixes locally
 */
export function validateSuggestedFix(
  content: string,
  error: DetectedError,
  suggestion: { text: string }
): { canApply: boolean; resultingContent?: string } {
  try {
    // Simple validation: just check if applying the suggestion makes sense
    // This is a placeholder - in reality you'd parse and validate
    
    if (error.line > 0 && error.line <= content.split('\n').length) {
      return { canApply: true };
    }
    
    return { canApply: false };
  } catch (e) {
    return { canApply: false };
  }
}

export default {
  aggregateChunkErrors,
  validateSuggestedFix,
};
