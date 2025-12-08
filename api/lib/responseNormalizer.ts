/**
 * Response Normalizer
 * Creates consistent, normalized API responses following the standard shape
 */

import type { VercelResponse } from '@vercel/node';
import { logger } from './logger';

// Standard error object in response
export interface NormalizedError {
  id: string;
  type: 'syntax' | 'structure' | 'semantic' | 'validation' | 'warning';
  line: number | null;
  column: number | null;
  position?: number | null;
  message: string;
  explanation?: string;
  confidence?: number;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  snippet?: string;
  suggestions?: Array<{
    text: string;
    safety: 'safe' | 'risky' | 'dangerous';
    confidence?: number;
  }>;
}

// Standard success response shape
export interface NormalizedResponse {
  status: 'ok' | 'llm_parse_error' | 'error';
  request_id: string;
  file_type: string;
  content_hash?: string;
  truncated: boolean;
  total_errors: number;
  total_warnings: number;
  errors: NormalizedError[];
  analysis_time_ms: number;
  raw_llm_output?: string;
  cached: boolean;
  
  // Additional metadata
  llm_provider?: string;
  llm_model?: string;
  tokens_used?: number;
  parser_hints?: any[];
  rag_used?: boolean;
  sanity_checks?: {
    passed: number;
    failed: number;
  };
}

// Standard error response shape
export interface NormalizedErrorResponse {
  status: 'error';
  request_id: string;
  error_type: string;
  message: string;
  details?: string;
  suggestions?: string[];
  retry_after?: number; // For rate limiting
}

/**
 * Sanitize content for logging - strip potential sensitive data
 */
export function sanitizeForLogging(content: string, maxLength: number = 200): string {
  if (!content) return '';
  
  // Patterns to redact
  const patterns = [
    // API keys
    /[a-zA-Z0-9]{32,}/g,
    // Email addresses
    /[\w.-]+@[\w.-]+\.\w+/g,
    // URLs with auth
    /https?:\/\/[^\/]*:[^@]+@/g,
    // JWT tokens
    /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  ];

  let sanitized = content;
  patterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '... [truncated]';
  }

  return sanitized;
}

/**
 * Create normalized success response
 */
export function createSuccessResponse(data: {
  request_id: string;
  file_type: string;
  content_hash?: string;
  truncated: boolean;
  errors: any[];
  analysis_time_ms: number;
  cached?: boolean;
  llm_provider?: string;
  llm_model?: string;
  tokens_used?: number;
  parser_hints?: any[];
  rag_snippets_used?: number;
  sanity_checks_passed?: number;
  sanity_checks_failed?: number;
  raw_llm_output?: string;
}): NormalizedResponse {
  // Separate errors and warnings
  const errors = data.errors.filter(e => e.type !== 'warning');
  const warnings = data.errors.filter(e => e.type === 'warning');

  // Normalize error objects
  const normalizedErrors: NormalizedError[] = data.errors.map((err, index) => ({
    id: err.id || `err-${index + 1}`,
    type: normalizeErrorType(err.type || err.category),
    line: err.line ?? null,
    column: err.column ?? null,
    position: err.position ?? null,
    message: err.message || 'Unknown error',
    explanation: err.explanation,
    confidence: err.confidence,
    severity: err.severity || inferSeverity(err),
    snippet: err.snippet,
    suggestions: err.suggestions?.map((s: any) => ({
      text: s.text || s.suggestion || String(s),
      safety: s.safety || s.risk || 'safe',
      confidence: s.confidence,
    })),
  }));

  return {
    status: 'ok',
    request_id: data.request_id,
    file_type: data.file_type,
    content_hash: data.content_hash,
    truncated: data.truncated,
    total_errors: errors.length,
    total_warnings: warnings.length,
    errors: normalizedErrors,
    analysis_time_ms: Math.round(data.analysis_time_ms),
    cached: data.cached ?? false,
    llm_provider: data.llm_provider,
    llm_model: data.llm_model,
    tokens_used: data.tokens_used,
    parser_hints: data.parser_hints,
    rag_used: (data.rag_snippets_used ?? 0) > 0,
    sanity_checks: (data.sanity_checks_passed !== undefined || data.sanity_checks_failed !== undefined) ? {
      passed: data.sanity_checks_passed ?? 0,
      failed: data.sanity_checks_failed ?? 0,
    } : undefined,
    raw_llm_output: process.env.NODE_ENV === 'development' ? data.raw_llm_output : undefined,
  };
}

/**
 * Create normalized LLM parse error response
 */
export function createParseErrorResponse(data: {
  request_id: string;
  file_type: string;
  truncated: boolean;
  analysis_time_ms: number;
  raw_llm_output: string;
  parser_hints?: any[];
  error_message?: string;
}): NormalizedResponse {
  return {
    status: 'llm_parse_error',
    request_id: data.request_id,
    file_type: data.file_type,
    truncated: data.truncated,
    total_errors: 0,
    total_warnings: 0,
    errors: [],
    analysis_time_ms: Math.round(data.analysis_time_ms),
    cached: false,
    raw_llm_output: data.raw_llm_output,
    parser_hints: data.parser_hints,
  };
}

/**
 * Create normalized error response
 */
export function createErrorResponse(data: {
  request_id: string;
  error_type: string;
  message: string;
  details?: string;
  suggestions?: string[];
  retry_after?: number;
}): NormalizedErrorResponse {
  return {
    status: 'error',
    request_id: data.request_id,
    error_type: data.error_type,
    message: data.message,
    details: sanitizeForLogging(data.details || '', 500),
    suggestions: data.suggestions,
    retry_after: data.retry_after,
  };
}

/**
 * Send normalized success response
 */
export function sendSuccessResponse(
  res: VercelResponse,
  data: Parameters<typeof createSuccessResponse>[0]
): void {
  const response = createSuccessResponse(data);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Request-ID', response.request_id);
  
  if (response.cached) {
    res.setHeader('X-Cache-Status', 'HIT');
  }
  
  res.status(200).json(response);
  
  logger.info(`[Response] ${response.status} - ${response.total_errors} errors, ${response.analysis_time_ms}ms`);
}

/**
 * Send normalized error response
 */
export function sendErrorResponse(
  res: VercelResponse,
  statusCode: number,
  data: Parameters<typeof createErrorResponse>[0]
): void {
  const response = createErrorResponse(data);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Request-ID', response.request_id);
  
  if (response.retry_after) {
    res.setHeader('Retry-After', String(response.retry_after));
  }
  
  res.status(statusCode).json(response);
  
  logger.warn(`[Response] ${statusCode} ${response.error_type}: ${response.message}`);
}

/**
 * Send rate limit error response
 */
export function sendRateLimitResponse(
  res: VercelResponse,
  request_id: string,
  retryAfterSeconds: number = 60
): void {
  sendErrorResponse(res, 429, {
    request_id,
    error_type: 'rate_limit_exceeded',
    message: 'Too many requests. Please try again later.',
    details: `You have exceeded the rate limit. Please wait ${retryAfterSeconds} seconds before making another request.`,
    suggestions: [
      `Wait ${retryAfterSeconds} seconds before retrying`,
      'Consider implementing client-side rate limiting',
      'Contact support if you need higher rate limits',
    ],
    retry_after: retryAfterSeconds,
  });
}

/**
 * Normalize error type from various formats
 */
function normalizeErrorType(type: string): NormalizedError['type'] {
  const normalized = type?.toLowerCase() || 'syntax';
  
  if (normalized.includes('syntax')) return 'syntax';
  if (normalized.includes('structure')) return 'structure';
  if (normalized.includes('semantic')) return 'semantic';
  if (normalized.includes('validation')) return 'validation';
  if (normalized.includes('warning')) return 'warning';
  
  return 'syntax'; // Default
}

/**
 * Infer severity from error properties
 */
function inferSeverity(error: any): NormalizedError['severity'] {
  if (error.severity) return error.severity;
  
  // Check message for severity indicators
  const message = (error.message || '').toLowerCase();
  
  if (message.includes('critical') || message.includes('fatal')) {
    return 'critical';
  }
  if (message.includes('warning')) {
    return 'low';
  }
  if (message.includes('syntax') || message.includes('invalid')) {
    return 'high';
  }
  
  return 'medium'; // Default
}

export default {
  createSuccessResponse,
  createParseErrorResponse,
  createErrorResponse,
  sendSuccessResponse,
  sendErrorResponse,
  sendRateLimitResponse,
  sanitizeForLogging,
};
