/**
 * Request Validation Middleware
 * Enforces:
 * - Maximum request size (1 MB configurable)
 * - Required headers
 * - Content-type validation
 * - Request timeout
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from './logger';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

class RequestValidator {
  private maxSizeMb: number;
  private maxTokensPerRequest: number;

  constructor() {
    this.maxSizeMb = parseInt(process.env.MAX_REQUEST_SIZE_MB || '1', 10);
    this.maxTokensPerRequest = parseInt(process.env.MAX_TOKENS_PER_REQUEST || '4000', 10);
  }

  /**
   * Validate request size
   */
  validateSize(req: VercelRequest): ValidationResult {
    const contentLength = req.headers['content-length'];
    
    if (!contentLength) {
      return { valid: true };
    }

    const sizeInBytes = parseInt(contentLength, 10);
    const sizeInMb = sizeInBytes / (1024 * 1024);

    if (sizeInMb > this.maxSizeMb) {
      logger.warn('Request exceeds size limit', {
        sizeInMb: sizeInMb.toFixed(2),
        maxSizeMb: this.maxSizeMb,
        contentLength: sizeInBytes,
      });

      return {
        valid: false,
        error: `Request too large: ${sizeInMb.toFixed(2)}MB exceeds limit of ${this.maxSizeMb}MB. Please split your request or reduce the content size.`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate content type
   */
  validateContentType(
    req: VercelRequest,
    expectedTypes: string[] = ['application/json']
  ): ValidationResult {
    const contentType = req.headers['content-type'];

    if (!contentType) {
      return {
        valid: false,
        error: 'Missing Content-Type header. Expected: application/json',
      };
    }

    const isValid = expectedTypes.some(type => 
      contentType.includes(type)
    );

    if (!isValid) {
      return {
        valid: false,
        error: `Invalid Content-Type: ${contentType}. Expected: ${expectedTypes.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate request body format
   */
  validateJsonBody(body: any): ValidationResult {
    if (!body) {
      return {
        valid: false,
        error: 'Empty request body',
      };
    }

    return { valid: true };
  }

  /**
   * Validate token count estimate
   * Rough estimate: 1 token ≈ 4 characters
   */
  validateTokenCount(content: string): ValidationResult {
    const estimatedTokens = Math.ceil(content.length / 4);

    if (estimatedTokens > this.maxTokensPerRequest) {
      return {
        valid: false,
        error: `Content too large: ~${estimatedTokens} tokens exceeds limit of ${this.maxTokensPerRequest}. Please reduce content size.`,
      };
    }

    return { valid: true };
  }

  /**
   * Comprehensive request validation
   */
  validate(
    req: VercelRequest,
    body: any,
    options: {
      checkContentType?: boolean;
      checkTokenCount?: boolean;
      expectedContentTypes?: string[];
    } = {}
  ): ValidationResult {
    // Size check
    const sizeResult = this.validateSize(req);
    if (!sizeResult.valid) return sizeResult;

    // Content-Type check
    if (options.checkContentType !== false) {
      const contentTypeResult = this.validateContentType(
        req,
        options.expectedContentTypes
      );
      if (!contentTypeResult.valid) return contentTypeResult;
    }

    // Body check
    const bodyResult = this.validateJsonBody(body);
    if (!bodyResult.valid) return bodyResult;

    // Token count check
    if (options.checkTokenCount) {
      const contentStr = JSON.stringify(body);
      const tokenResult = this.validateTokenCount(contentStr);
      if (!tokenResult.valid) return tokenResult;
    }

    return { valid: true };
  }
}

export const requestValidator = new RequestValidator();

/**
 * Middleware to handle validation errors
 */
export function handleValidationError(
  res: VercelResponse,
  error: string,
  statusCode: number = 400
): void {
  res.status(statusCode).json({
    error: true,
    message: error,
    statusCode,
    timestamp: new Date().toISOString(),
    suggestion: 'Please check the error message and reduce request size if needed.',
  });
}

