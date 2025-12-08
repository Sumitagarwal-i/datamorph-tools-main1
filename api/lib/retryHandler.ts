/**
 * Retry Handler with Exponential Backoff
 * Handles LLM call retries, timeouts, and fallback strategies
 */

import { logger } from './logger';

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
  backoffMultiplier: number;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 1,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  timeoutMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelayMs
  );
  // Add jitter (±20%) to prevent thundering herd
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.round(delay + jitter);
}

/**
 * Execute function with timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle!);
    throw error;
  }
}

/**
 * Retry an async operation with exponential backoff
 * 
 * @param operation - Async function to retry
 * @param config - Retry configuration
 * @param context - Context info for logging
 * @returns RetryResult with success status and data/error
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context: string = 'operation'
): Promise<RetryResult<T>> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: Error | undefined;
  let attempts = 0;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    attempts++;

    try {
      logger.debug(`[RetryHandler] Attempt ${attempt + 1}/${finalConfig.maxRetries + 1} for ${context}`);

      // Execute with timeout
      const result = await withTimeout(
        operation(),
        finalConfig.timeoutMs,
        `${context} timed out after ${finalConfig.timeoutMs}ms`
      );

      const duration = Date.now() - startTime;
      logger.info(`[RetryHandler] ${context} succeeded on attempt ${attempt + 1} (${duration}ms)`);

      return {
        success: true,
        data: result,
        attempts,
        totalDuration: duration,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const duration = Date.now() - startTime;

      logger.warn(
        `[RetryHandler] ${context} failed on attempt ${attempt + 1}/${finalConfig.maxRetries + 1}: ${lastError.message}`
      );

      // Don't retry if it's the last attempt
      if (attempt < finalConfig.maxRetries) {
        const delay = calculateDelay(attempt, finalConfig);
        logger.debug(`[RetryHandler] Waiting ${delay}ms before retry...`);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  const totalDuration = Date.now() - startTime;
  logger.error(
    `[RetryHandler] ${context} failed after ${attempts} attempts (${totalDuration}ms): ${lastError?.message}`
  );

  return {
    success: false,
    error: lastError,
    attempts,
    totalDuration,
  };
}

/**
 * Check if error is retryable
 * Non-retryable errors: 400, 401, 403, 404, 422
 * Retryable errors: 429, 500, 502, 503, 504, network errors, timeouts
 */
export function isRetryableError(error: any): boolean {
  // Network errors (no response)
  if (!error.response && (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT')) {
    return true;
  }

  // HTTP status codes
  if (error.response?.status) {
    const status = error.response.status;
    
    // Rate limiting - retryable
    if (status === 429) {
      return true;
    }
    
    // Server errors - retryable
    if (status >= 500 && status < 600) {
      return true;
    }
    
    // Client errors - not retryable
    if (status >= 400 && status < 500) {
      return false;
    }
  }

  // Timeout errors
  if (error.message?.includes('timed out') || error.message?.includes('timeout')) {
    return true;
  }

  // Default: retry on unknown errors
  return true;
}

/**
 * Smart retry: only retry if error is retryable
 */
export async function smartRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context: string = 'operation'
): Promise<RetryResult<T>> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: Error | undefined;
  let attempts = 0;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    attempts++;

    try {
      logger.debug(`[SmartRetry] Attempt ${attempt + 1}/${finalConfig.maxRetries + 1} for ${context}`);

      const result = await withTimeout(
        operation(),
        finalConfig.timeoutMs,
        `${context} timed out after ${finalConfig.timeoutMs}ms`
      );

      const duration = Date.now() - startTime;
      logger.info(`[SmartRetry] ${context} succeeded on attempt ${attempt + 1} (${duration}ms)`);

      return {
        success: true,
        data: result,
        attempts,
        totalDuration: duration,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const duration = Date.now() - startTime;

      logger.warn(
        `[SmartRetry] ${context} failed on attempt ${attempt + 1}/${finalConfig.maxRetries + 1}: ${lastError.message}`
      );

      // Check if error is retryable
      const shouldRetry = isRetryableError(error);

      if (!shouldRetry) {
        logger.info(`[SmartRetry] Error is not retryable, stopping retry attempts`);
        break;
      }

      // Don't retry if it's the last attempt
      if (attempt < finalConfig.maxRetries) {
        const delay = calculateDelay(attempt, finalConfig);
        logger.debug(`[SmartRetry] Waiting ${delay}ms before retry...`);
        await sleep(delay);
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  logger.error(
    `[SmartRetry] ${context} failed after ${attempts} attempts (${totalDuration}ms): ${lastError?.message}`
  );

  return {
    success: false,
    error: lastError,
    attempts,
    totalDuration,
  };
}

export default {
  retryWithBackoff,
  smartRetry,
  isRetryableError,
};
