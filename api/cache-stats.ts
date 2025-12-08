/**
 * GET /api/cache-stats - Cache statistics endpoint
 * Returns cache hit/miss rates and other metrics
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCacheStats } from './lib/cacheManager';
import { logger } from './lib/logger';
import { randomUUID } from 'crypto';

interface CacheStatsResponse {
  cache_enabled: boolean;
  stats: {
    hits: number;
    misses: number;
    invalidations: number;
    total_requests: number;
    hit_rate: number;
    hit_rate_percentage: string;
  };
  storage: {
    backend: 'redis' | 'memory';
    ttl_seconds: number;
  };
  versions: {
    model_version: string;
    rag_version: string;
  };
}

interface ErrorResponse {
  error: true;
  message: string;
  statusCode: number;
  request_id: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const requestId = randomUUID();

  try {
    // Only allow GET
    if (req.method !== 'GET') {
      const errorResponse: ErrorResponse = {
        error: true,
        message: 'Method not allowed',
        statusCode: 405,
        request_id: requestId,
      };
      res.status(405).json(errorResponse);
    }

    // Get cache statistics
    const stats = await getCacheStats();

    // Determine backend
    const backend = process.env.REDIS_URL ? 'redis' : 'memory';
    const cacheEnabled = process.env.CACHE_ENABLED !== 'false';

    const response: CacheStatsResponse = {
      cache_enabled: cacheEnabled,
      stats: {
        hits: stats.hits,
        misses: stats.misses,
        invalidations: stats.invalidations,
        total_requests: stats.total_requests,
        hit_rate: stats.hit_rate,
        hit_rate_percentage: `${(stats.hit_rate * 100).toFixed(2)}%`,
      },
      storage: {
        backend,
        ttl_seconds: parseInt(process.env.CACHE_TTL_SECONDS || '86400'),
      },
      versions: {
        model_version: process.env.MODEL_VERSION || 'llama-3.1-8b-instant-v1',
        rag_version: process.env.RAG_VERSION || '1.0.0',
      },
    };

    logger.info('Cache stats retrieved', {
      request_id: requestId,
      hit_rate: stats.hit_rate,
      total_requests: stats.total_requests,
    });

    res.setHeader('X-Request-ID', requestId);
    res.status(200).json(response);
  } catch (error) {
    logger.error('Failed to retrieve cache stats', error instanceof Error ? error : new Error(String(error)), {
      request_id: requestId,
    });

    const errorResponse: ErrorResponse = {
      error: true,
      message: 'Internal server error',
      statusCode: 500,
      request_id: requestId,
    };

    res.status(500).json(errorResponse);
  }
}

