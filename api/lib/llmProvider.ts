/**
 * LLM Provider Integration for Detective D
 * 
 * Supports multiple LLM providers with focus on Groq API
 * Includes streaming, retry logic, and error handling
 */

import { logger } from './logger';
import { buildPrompt, getLLMConfig, validateLLMResponse } from './promptBuilder';
import type { LLMAnalysisResponse, DetectedError } from './promptBuilder';
import { normalizeErrorPositions } from './positionMapper';
import type { TruncationMap } from './positionMapper';
import { postProcessResponse } from './postProcessor';

// Provider types
type LLMProvider = 'groq' | 'openai' | 'anthropic';

// LLM request parameters
interface LLMRequestParams {
  fileType: 'json' | 'csv' | 'xml' | 'yaml';
  content: string;
  originalContent?: string;  // Original content before truncation (for position mapping)
  fileName?: string;
  parserHints?: any[];
  ragSnippets?: any[];
  truncationMap?: TruncationMap;
  truncationNote?: string;
  maxErrors?: number;
  stream?: boolean;
  requestId: string;
}

// LLM response
interface LLMResponse {
  success: boolean;
  data?: LLMAnalysisResponse;
  error?: string;
  provider: LLMProvider;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  latency_ms: number;
  retries: number;
  sanity_checks_passed?: number;
  sanity_checks_failed?: number;
}

// Groq API configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

// Retry configuration
const MAX_RETRIES = 1;
const INITIAL_RETRY_DELAY = 500; // ms
const MAX_RETRY_DELAY = 1500; // ms

// Timeout configuration
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Call LLM for error analysis
 */
export async function callLLM(params: LLMRequestParams): Promise<LLMResponse> {
  const startTime = Date.now();
  let retries = 0;

  logger.info('Starting LLM call', {
    request_id: params.requestId,
    provider: 'groq',
    model: GROQ_MODEL,
    file_type: params.fileType,
    content_length: params.content.length,
    stream: params.stream || false,
  });

  // Build prompt
  const prompt = buildPrompt({
    fileType: params.fileType,
    content: params.content,
    fileName: params.fileName,
    parserHints: params.parserHints,
    ragSnippets: params.ragSnippets,
    truncationMap: params.truncationMap,
    truncationNote: params.truncationNote,
    maxErrors: params.maxErrors || 100,
  });

  // Get LLM configuration
  const llmConfig = getLLMConfig(params.content.length, params.maxErrors || 100);

  logger.debug('Prompt constructed', {
    request_id: params.requestId,
    prompt_length: prompt.length,
    estimated_tokens: Math.ceil(prompt.length / 4),
    llm_config: llmConfig,
  });

  // Attempt LLM call with retry logic
  while (retries <= MAX_RETRIES) {
    try {
      if (params.stream) {
        // Streaming response
        return await callLLMStreaming(
          prompt, 
          llmConfig, 
          params.requestId, 
          retries,
          params.originalContent,
          params.truncationMap,
          params.fileType
        );
      } else {
        // Non-streaming response
        return await callLLMNonStreaming(
          prompt, 
          llmConfig, 
          params.requestId, 
          retries,
          params.originalContent,
          params.truncationMap,
          params.fileType
        );
      }
    } catch (error: any) {
      const isRetryable = isRetryableError(error);
      const isLastRetry = retries >= MAX_RETRIES;

      logger.warn('LLM call failed', {
        request_id: params.requestId,
        error: error.message,
        status: error.status,
        retryable: isRetryable,
        retry_attempt: retries,
        is_last_retry: isLastRetry,
      });

      if (isRetryable && !isLastRetry) {
        // Exponential backoff
        const delay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(2, retries),
          MAX_RETRY_DELAY
        );
        
        logger.info('Retrying LLM call', {
          request_id: params.requestId,
          delay_ms: delay,
          retry_attempt: retries + 1,
        });

        await sleep(delay);
        retries++;
      } else {
        // No more retries or non-retryable error
        const latency = Date.now() - startTime;

        logger.error(
          'LLM call failed after retries',
          error instanceof Error ? error : new Error(String(error)),
          {
            request_id: params.requestId,
            retries,
            latency,
          }
        );

        return {
          success: false,
          error: error.message || 'LLM call failed',
          provider: 'groq',
          model: GROQ_MODEL,
          latency_ms: latency,
          retries,
        };
      }
    }
  }

  // Should not reach here
  return {
    success: false,
    error: 'Max retries exceeded',
    provider: 'groq',
    model: GROQ_MODEL,
    latency_ms: Date.now() - startTime,
    retries,
  };
}

/**
 * Non-streaming LLM call
 */
async function callLLMNonStreaming(
  prompt: string,
  llmConfig: any,
  requestId: string,
  retryCount: number,
  originalContent?: string,
  truncationMap?: TruncationMap,
  fileType?: 'json' | 'csv' | 'xml' | 'yaml'
): Promise<LLMResponse> {
  const startTime = Date.now();

  // Prepare request
  const requestBody = {
    model: GROQ_MODEL,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.0,
    max_tokens: llmConfig.max_tokens,
    top_p: 1.0,
    stream: false,
  };

  // Make API call with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    // Extract response content
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in LLM response');
    }

    logger.debug('Raw LLM response', {
      request_id: requestId,
      content_preview: content.substring(0, 200),
      content_length: content.length,
    });

    // Parse JSON response with robust fallbacks
    const parseResult = parseJSONResponse(content);
    
    if (!parseResult.success) {
      logger.error('Failed to parse LLM response as JSON', undefined, {
        request_id: requestId,
        error: parseResult.error,
        raw_content_preview: content.substring(0, 500),
      });
      
      // Return parse error with raw content
      throw new Error(JSON.stringify({
        type: 'llm_parse_error',
        message: parseResult.error,
        raw_llm_output: content,
      }));
    }

    logger.debug('JSON parse succeeded', {
      request_id: requestId,
      strategy: parseResult.strategy,
    });

    let parsedResponse = parseResult.data;

    // Attempt schema repair before validation
    parsedResponse = repairLLMResponseSchema(parsedResponse);

    // Validate response schema
    const validation = validateLLMResponse(parsedResponse);
    if (!validation.valid) {
      logger.error('LLM response validation failed after repair', undefined, {
        request_id: requestId,
        validation_errors: validation.errors,
        parsed_response: parsedResponse,
      });
      
      // Return validation error with details
      throw new Error(JSON.stringify({
        type: 'schema_validation_error',
        message: 'LLM response does not match expected schema',
        validation_errors: validation.errors,
        parsed_response: parsedResponse,
      }));
    }

    // Normalize error positions if original content provided
    let finalData = validation.data!;
    if (originalContent && finalData.errors && finalData.errors.length > 0) {
      logger.debug('Normalizing error positions', {
        request_id: requestId,
        error_count: finalData.errors.length,
        has_truncation_map: !!truncationMap,
      });

      const normalizedErrors = normalizeErrorPositions(
        finalData.errors,
        originalContent,
        truncationMap,
        requestId
      );

      finalData = {
        ...finalData,
        errors: normalizedErrors as DetectedError[],
      };

      logger.debug('Position normalization complete', {
        request_id: requestId,
        normalized_count: normalizedErrors.length,
      });
    }

    // Post-process: normalize suggestions, confidence, safety, and perform sanity checks
    const postProcessed = postProcessResponse(
      finalData,
      originalContent || content,
      fileType || 'json',
      startTime,
      { enableSanityCheck: true }
    );

    logger.debug('Post-processing complete', {
      request_id: requestId,
      sanity_checks_passed: postProcessed.sanity_checks_passed,
      sanity_checks_failed: postProcessed.sanity_checks_failed,
    });

    logger.info('LLM call succeeded', {
      request_id: requestId,
      provider: 'groq',
      model: GROQ_MODEL,
      latency,
      errors_found: postProcessed.total_errors,
      prompt_tokens: data.usage?.prompt_tokens,
      completion_tokens: data.usage?.completion_tokens,
      total_tokens: data.usage?.total_tokens,
      retries: retryCount,
      sanity_checks_passed: postProcessed.sanity_checks_passed,
      sanity_checks_failed: postProcessed.sanity_checks_failed,
    });

    return {
      success: true,
      data: {
        errors: postProcessed.errors,
        total_errors: postProcessed.total_errors,
        analysis_confidence: postProcessed.analysis_confidence,
      },
      sanity_checks_passed: postProcessed.sanity_checks_passed,
      sanity_checks_failed: postProcessed.sanity_checks_failed,
      provider: 'groq',
      model: GROQ_MODEL,
      usage: {
        prompt_tokens: data.usage?.prompt_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0,
      },
      latency_ms: latency,
      retries: retryCount,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('LLM request timeout');
    }

    throw error;
  }
}

/**
 * Streaming LLM call
 */
async function callLLMStreaming(
  prompt: string,
  llmConfig: any,
  requestId: string,
  retryCount: number,
  originalContent?: string,
  truncationMap?: TruncationMap,
  fileType?: 'json' | 'csv' | 'xml' | 'yaml'
): Promise<LLMResponse> {
  const startTime = Date.now();

  // Prepare request
  const requestBody = {
    model: GROQ_MODEL,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.0,
    max_tokens: llmConfig.max_tokens,
    top_p: 1.0,
    stream: true,
  };

  // Make API call with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    // Process streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedContent = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      // Decode chunk
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          
          if (data === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            
            if (delta) {
              accumulatedContent += delta;
            }
          } catch (e) {
            // Ignore parse errors for individual chunks
            logger.debug('Failed to parse SSE chunk', {
              request_id: requestId,
              line,
            });
          }
        }
      }
    }

    const latency = Date.now() - startTime;

    logger.debug('Streaming completed', {
      request_id: requestId,
      accumulated_length: accumulatedContent.length,
      latency,
    });

    // Parse accumulated JSON with robust fallbacks
    const parseResult = parseJSONResponse(accumulatedContent);
    
    if (!parseResult.success) {
      logger.error('Failed to parse streamed JSON', undefined, {
        request_id: requestId,
        error: parseResult.error,
        accumulated_content_preview: accumulatedContent.substring(0, 500),
      });
      
      throw new Error(JSON.stringify({
        type: 'llm_parse_error',
        message: parseResult.error,
        raw_llm_output: accumulatedContent,
      }));
    }

    logger.debug('Streaming JSON parse succeeded', {
      request_id: requestId,
      strategy: parseResult.strategy,
    });

    let parsedResponse = parseResult.data;

    // Attempt schema repair before validation
    parsedResponse = repairLLMResponseSchema(parsedResponse);

    // Validate response schema
    const validation = validateLLMResponse(parsedResponse);
    if (!validation.valid) {
      logger.error('Streamed response validation failed after repair', undefined, {
        request_id: requestId,
        validation_errors: validation.errors,
      });
      
      throw new Error(JSON.stringify({
        type: 'schema_validation_error',
        message: 'Streamed response does not match expected schema',
        validation_errors: validation.errors,
        parsed_response: parsedResponse,
      }));
    }

    // Normalize error positions if original content provided
    let finalData = validation.data!;
    if (originalContent && finalData.errors && finalData.errors.length > 0) {
      logger.debug('Normalizing error positions (streaming)', {
        request_id: requestId,
        error_count: finalData.errors.length,
        has_truncation_map: !!truncationMap,
      });

      const normalizedErrors = normalizeErrorPositions(
        finalData.errors,
        originalContent,
        truncationMap,
        requestId
      );

      finalData = {
        ...finalData,
        errors: normalizedErrors as DetectedError[],
      };

      logger.debug('Position normalization complete (streaming)', {
        request_id: requestId,
        normalized_count: normalizedErrors.length,
      });
    }

    // Post-process: normalize suggestions, confidence, safety, and perform sanity checks
    const postProcessed = postProcessResponse(
      finalData,
      originalContent || accumulatedContent,
      fileType || 'json',
      startTime,
      { enableSanityCheck: true }
    );

    logger.debug('Post-processing complete (streaming)', {
      request_id: requestId,
      sanity_checks_passed: postProcessed.sanity_checks_passed,
      sanity_checks_failed: postProcessed.sanity_checks_failed,
    });

    logger.info('Streaming LLM call succeeded', {
      request_id: requestId,
      provider: 'groq',
      model: GROQ_MODEL,
      latency,
      errors_found: postProcessed.total_errors,
      retries: retryCount,
      sanity_checks_passed: postProcessed.sanity_checks_passed,
      sanity_checks_failed: postProcessed.sanity_checks_failed,
    });

    return {
      success: true,
      data: {
        errors: postProcessed.errors,
        total_errors: postProcessed.total_errors,
        analysis_confidence: postProcessed.analysis_confidence,
      },
      sanity_checks_passed: postProcessed.sanity_checks_passed,
      sanity_checks_failed: postProcessed.sanity_checks_failed,
      provider: 'groq',
      model: GROQ_MODEL,
      latency_ms: latency,
      retries: retryCount,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('Streaming request timeout');
    }

    throw error;
  }
}

/**
 * Parse JSON response with robust fallback strategies
 * Returns: { success: boolean, data?: any, error?: string, rawContent?: string }
 */
function parseJSONResponse(content: string): {
  success: boolean;
  data?: any;
  error?: string;
  rawContent?: string;
  strategy?: string;
} {
  const trimmed = content.trim();

  // Strategy 1: Direct parse (clean JSON)
  try {
    const parsed = JSON.parse(trimmed);
    return { success: true, data: parsed, strategy: 'direct' };
  } catch (e1) {
    // Continue to fallbacks
  }

  // Strategy 2: Extract from markdown code blocks
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      return { success: true, data: parsed, strategy: 'markdown' };
    } catch (e2) {
      // Continue to next strategy
    }
  }

  // Strategy 3: Strip leading/trailing text, find first { and last }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const extracted = trimmed.substring(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(extracted);
      return { success: true, data: parsed, strategy: 'brace_extraction' };
    } catch (e3) {
      // Continue to next strategy
    }
  }

  // Strategy 4: Find balanced brace pairs using stack
  const balanced = extractBalancedJSON(trimmed);
  if (balanced) {
    try {
      const parsed = JSON.parse(balanced);
      return { success: true, data: parsed, strategy: 'balanced_braces' };
    } catch (e4) {
      // Continue to next strategy
    }
  }

  // Strategy 5: Try array extraction [first [ to last ]]
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');
  
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const extracted = trimmed.substring(firstBracket, lastBracket + 1);
    try {
      const parsed = JSON.parse(extracted);
      return { success: true, data: parsed, strategy: 'bracket_extraction' };
    } catch (e5) {
      // Continue to next strategy
    }
  }

  // Strategy 6: Regex match for complete JSON objects
  const jsonObjectMatch = trimmed.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
  if (jsonObjectMatch) {
    try {
      const parsed = JSON.parse(jsonObjectMatch[0]);
      return { success: true, data: parsed, strategy: 'regex_object' };
    } catch (e6) {
      // All strategies failed
    }
  }

  // All strategies failed
  return {
    success: false,
    error: 'Could not extract valid JSON from LLM response',
    rawContent: trimmed,
  };
}

/**
 * Extract balanced JSON using brace matching
 */
function extractBalancedJSON(content: string): string | null {
  const firstBrace = content.indexOf('{');
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = firstBrace; i < content.length; i++) {
    const char = content[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        // Found balanced JSON
        return content.substring(firstBrace, i + 1);
      }
    }
  }

  return null; // No balanced JSON found
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any): boolean {
  // Timeout errors are retryable
  if (error.name === 'AbortError' || error.message?.includes('timeout')) {
    return true;
  }

  // Network errors are retryable
  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return true;
  }

  // 5xx status codes are retryable
  if (error.status && error.status >= 500 && error.status < 600) {
    return true;
  }

  // Rate limits (429) are retryable
  if (error.status === 429) {
    return true;
  }

  // All other errors are not retryable (4xx client errors, parse errors, etc.)
  return false;
}

/**
 * Repair common schema issues in LLM response
 */
function repairLLMResponseSchema(response: any): any {
  if (!response || typeof response !== 'object') {
    return response;
  }

  // Ensure errors array exists
  if (!Array.isArray(response.errors)) {
    response.errors = [];
  }

  // Repair each error object
  response.errors = response.errors.map((error: any) => {
    const repaired: any = { ...error };

    // Coerce confidence to number
    if (typeof repaired.confidence === 'string') {
      const parsed = parseFloat(repaired.confidence);
      repaired.confidence = isNaN(parsed) ? 0.5 : Math.min(Math.max(parsed, 0), 1);
    } else if (typeof repaired.confidence !== 'number') {
      repaired.confidence = 0.5;
    } else {
      // Clamp to 0-1 range
      repaired.confidence = Math.min(Math.max(repaired.confidence, 0), 1);
    }

    // Coerce line to number
    if (typeof repaired.line === 'string') {
      const parsed = parseInt(repaired.line, 10);
      repaired.line = isNaN(parsed) ? 1 : Math.max(parsed, 1);
    } else if (typeof repaired.line !== 'number') {
      repaired.line = 1;
    }

    // Coerce column to number if present
    if (repaired.column !== undefined) {
      if (typeof repaired.column === 'string') {
        const parsed = parseInt(repaired.column, 10);
        repaired.column = isNaN(parsed) ? undefined : Math.max(parsed, 1);
      } else if (typeof repaired.column !== 'number') {
        repaired.column = undefined;
      }
    }

    // Coerce position to number if present
    if (repaired.position !== undefined) {
      if (typeof repaired.position === 'string') {
        const parsed = parseInt(repaired.position, 10);
        repaired.position = isNaN(parsed) ? undefined : Math.max(parsed, 0);
      } else if (typeof repaired.position !== 'number') {
        repaired.position = undefined;
      }
    }

    // Ensure type is valid
    if (!['error', 'warning'].includes(repaired.type)) {
      repaired.type = 'error';
    }

    // Ensure severity is valid
    if (!['critical', 'high', 'medium', 'low'].includes(repaired.severity)) {
      // Try to infer severity
      if (repaired.type === 'warning') {
        repaired.severity = 'low';
      } else {
        repaired.severity = 'medium';
      }
    }

    // Ensure category exists
    if (!repaired.category || typeof repaired.category !== 'string') {
      repaired.category = 'syntax';
    }

    // Ensure message exists
    if (!repaired.message || typeof repaired.message !== 'string') {
      repaired.message = 'Unknown error';
    }

    // Ensure explanation exists
    if (!repaired.explanation || typeof repaired.explanation !== 'string') {
      repaired.explanation = repaired.message;
    }

    // Ensure suggestions is an array
    if (!Array.isArray(repaired.suggestions)) {
      repaired.suggestions = [];
    }

    // Repair suggestions
    repaired.suggestions = repaired.suggestions.map((sug: any) => {
      const repairedSug: any = { ...sug };

      if (!repairedSug.description || typeof repairedSug.description !== 'string') {
        repairedSug.description = 'No description provided';
      }

      if (!['safe', 'risky', 'manual_review'].includes(repairedSug.safety)) {
        repairedSug.safety = 'manual_review';
      }

      return repairedSug;
    });

    return repaired;
  });

  // Coerce total_errors to number
  if (typeof response.total_errors === 'string') {
    const parsed = parseInt(response.total_errors, 10);
    response.total_errors = isNaN(parsed) ? response.errors.length : parsed;
  } else if (typeof response.total_errors !== 'number') {
    response.total_errors = response.errors.length;
  }

  // Coerce analysis_confidence to number
  if (typeof response.analysis_confidence === 'string') {
    const parsed = parseFloat(response.analysis_confidence);
    response.analysis_confidence = isNaN(parsed) ? 0.5 : Math.min(Math.max(parsed, 0), 1);
  } else if (typeof response.analysis_confidence !== 'number') {
    response.analysis_confidence = 0.5;
  } else {
    response.analysis_confidence = Math.min(Math.max(response.analysis_confidence, 0), 1);
  }

  return response;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get provider info for logging
 */
export function getProviderInfo(): {
  provider: LLMProvider;
  model: string;
  api_base: string;
} {
  return {
    provider: 'groq',
    model: GROQ_MODEL,
    api_base: GROQ_API_BASE,
  };
}


