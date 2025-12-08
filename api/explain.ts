/**
 * Example API Route: Generate AI Explanation
 * Demonstrates proper use of security utilities:
 * - Rate limiting
 * - Request validation
 * - Logging
 * - Error handling
 * - LLM API key security
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { rateLimiter } from './lib/rateLimiter';
import { requestValidator, handleValidationError } from './lib/requestValidator';
import { logger, Logger } from './lib/logger';
import { envManager, requireApiKey } from './lib/envManager';

interface ExplainRequest {
  content: string;
  model?: 'openai' | 'anthropic' | 'cohere';
  language?: string;
  context?: string;
}

interface ExplainResponse {
  explanation: string;
  model: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  latency: number;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const startTime = Date.now();

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      res.status(405).json({
        error: true,
        message: 'Method not allowed. Use POST.',
      });
    }

    // Rate limiting check
    const rateLimitResult = rateLimiter.isAllowed(req);
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', {
        ipAddress: Logger.getClientIp(req),
        resetTime: new Date(rateLimitResult.resetTime).toISOString(),
      });

      res.status(429).json({
        error: true,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
        resetTime: new Date(rateLimitResult.resetTime).toISOString(),
      });
    }

    // Request validation
    const validationResult = requestValidator.validate(req, req.body, {
      checkContentType: true,
      checkTokenCount: true,
      expectedContentTypes: ['application/json'],
    });

    if (!validationResult.valid) {
      handleValidationError(res, validationResult.error!);
      return;
    }

    const body: ExplainRequest = req.body;

    // Validate required fields
    if (!body.content || typeof body.content !== 'string') {
      res.status(400).json({
        error: true,
        message: 'Missing or invalid required field: content',
      });
    }

    // Validate content is not empty
    if (body.content.trim().length === 0) {
      res.status(400).json({
        error: true,
        message: 'Content cannot be empty',
      });
    }

    const model = body.model || 'openai';
    const language = body.language || 'english';

    // Log incoming request
    logger.info('Explanation request received', {
      model,
      contentLength: body.content.length,
      language,
      ipAddress: Logger.getClientIp(req),
    });

    // Check if LLM is configured
    if (!envManager.hasLlmKey(model)) {
      logger.error(`${model} not configured`, new Error(`${model.toUpperCase()}_API_KEY missing`));

      res.status(503).json({
        error: true,
        message: `${model} is not configured. Please contact support.`,
        statusCode: 503,
      });
    }

    // Get API key (server-side only - NEVER expose to frontend)
    const apiKey = requireApiKey(model);

    // TODO: Call actual LLM API
    // For now, return mock response
    const mockExplanation = `This is a mock explanation of the provided content using ${model}.
    
In a real implementation, this would:
1. Send the content to the LLM API
2. Process and stream the response
3. Count actual tokens used
4. Handle errors gracefully
5. Log comprehensive metrics`;

    const mockTokens = {
      input: Math.ceil(body.content.length / 4),
      output: Math.ceil(mockExplanation.length / 4),
      total: Math.ceil((body.content.length + mockExplanation.length) / 4),
    };

    const latency = Date.now() - startTime;

    // Log successful API call
    logger.logApiCall({
      message: 'Explanation generated successfully',
      latency,
      model,
      tokens: mockTokens,
      ipAddress: Logger.getClientIp(req),
      context: {
        contentLength: body.content.length,
        language,
      },
    });

    // Add rate limit info to response headers
    const stats = rateLimiter.getStats(req);
    res.setHeader('X-RateLimit-Limit', stats.limit);
    res.setHeader('X-RateLimit-Remaining', stats.remaining);
    res.setHeader('X-RateLimit-Reset', stats.resetTime);
    res.setHeader('X-Response-Time', `${latency}ms`);

    // Return response
    res.status(200).json({
      explanation: mockExplanation,
      model,
      tokens: mockTokens,
      latency,
    } as ExplainResponse);
  } catch (error) {
    const latency = Date.now() - startTime;

    logger.error(
      'Unexpected error in /api/explain',
      error instanceof Error ? error : new Error(String(error)),
      {
        latency,
        ipAddress: Logger.getClientIp(req),
      }
    );

    res.status(500).json({
      error: true,
      message: 'Internal server error. Please try again later.',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
}


