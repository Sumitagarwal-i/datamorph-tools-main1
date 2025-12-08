/**
 * Health Check & Configuration Endpoint
 * Safe to expose - returns only non-sensitive information
 * Useful for monitoring and debugging
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { envManager } from './lib/envManager.js';
import { logger, Logger } from './lib/logger.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    const config = envManager.getConfig();

    // Check which LLM providers are available
    const availableProviders = [];
    if (config.openaiApiKey) availableProviders.push('openai');
    if (config.anthropicApiKey) availableProviders.push('anthropic');
    if (config.cohereApiKey) availableProviders.push('cohere');

    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      features: {
        availableLlmProviders: availableProviders.length > 0 ? availableProviders : 'none configured',
        errorTracking: config.sentryDsn ? 'enabled' : 'disabled',
        detailedLogging: config.enableDetailedLogging,
      },
      limits: {
        maxRequestSizeMb: config.maxRequestSizeMb,
        maxTokensPerRequest: config.maxTokensPerRequest,
        rateLimit: {
          requestsPerMinute: config.rateLimitPerMinute,
          requestsPerHour: config.rateLimitPerHour,
        },
      },
      version: '1.0.0',
      documentation: '/api/docs',
    };

    logger.info('Health check requested', {
      ipAddress: Logger.getClientIp(req),
      providersAvailable: availableProviders.length,
    });

    res.status(200).json(healthData);
  } catch (error) {
    logger.error(
      'Health check failed',
      error instanceof Error ? error : new Error(String(error))
    );

    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
}


