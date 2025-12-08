/**
 * GET /api/analytics - Analytics & Telemetry Dashboard Endpoint
 * 
 * Returns aggregated metrics for monitoring and cost tracking
 * Requires authentication
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger, Logger } from './_lib/logger.js';
import { 
  getAnalyticsSummary, 
  getCostSummary, 
  getPerformanceMetrics 
} from './_lib/telemetryLogger.js';
import { randomUUID } from 'crypto';

interface ErrorResponse {
  error: true;
  message: string;
  statusCode: number;
  request_id: string;
}

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const requestId = randomUUID();
  const startTime = Date.now();

  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      const errorResponse: ErrorResponse = {
        error: true,
        message: 'Method not allowed',
        statusCode: 405,
        request_id: requestId,
      };
      res.status(405).json(errorResponse);
      return;
    }

    // Check authentication (admin only)
    const authHeader = req.headers.authorization;
    const providedKey = authHeader?.replace('Bearer ', '');

    if (!ADMIN_API_KEY || providedKey !== ADMIN_API_KEY) {
      const errorResponse: ErrorResponse = {
        error: true,
        message: 'Unauthorized - Admin API key required',
        statusCode: 401,
        request_id: requestId,
      };
      
      logger.warn('Unauthorized analytics access attempt', {
        request_id: requestId,
        ipAddress: Logger.getClientIp(req),
      });
      
      res.status(401).json(errorResponse);
      return;
    }

    // Parse query parameters
    const { start_date, end_date, type } = req.query;
    const startDate = typeof start_date === 'string' ? start_date : undefined;
    const endDate = typeof end_date === 'string' ? end_date : undefined;
    const queryType = typeof type === 'string' ? type : 'summary';

    logger.info('Analytics request', {
      request_id: requestId,
      query_type: queryType,
      start_date: startDate,
      end_date: endDate,
      ipAddress: Logger.getClientIp(req),
    });

    // Return different data based on type
    switch (queryType) {
      case 'summary': {
        const [performanceMetrics, costSummary] = await Promise.all([
          getPerformanceMetrics(startDate, endDate),
          getCostSummary(startDate, endDate),
        ]);

        const totalCost = costSummary.reduce((sum, m) => sum + m.estimated_cost, 0);
        const totalTokens = costSummary.reduce((sum, m) => sum + m.total_tokens, 0);

        const response = {
          request_id: requestId,
          period: {
            start_date: startDate || 'beginning',
            end_date: endDate || 'now',
          },
          performance: performanceMetrics,
          cost: {
            total_estimated_cost_usd: Math.round(totalCost * 100) / 100,
            total_tokens: totalTokens,
            by_model: costSummary,
          },
          metadata: {
            generated_at: new Date().toISOString(),
            query_time_ms: Date.now() - startTime,
          },
        };

        res.status(200).json(response);
        break;
      }

      case 'performance': {
        const metrics = await getPerformanceMetrics(startDate, endDate);
        
        const response = {
          request_id: requestId,
          period: {
            start_date: startDate || 'beginning',
            end_date: endDate || 'now',
          },
          metrics,
          metadata: {
            generated_at: new Date().toISOString(),
            query_time_ms: Date.now() - startTime,
          },
        };

        res.status(200).json(response);
        break;
      }

      case 'cost': {
        const costSummary = await getCostSummary(startDate, endDate);
        const totalCost = costSummary.reduce((sum, m) => sum + m.estimated_cost, 0);
        const totalTokens = costSummary.reduce((sum, m) => sum + m.total_tokens, 0);

        const response = {
          request_id: requestId,
          period: {
            start_date: startDate || 'beginning',
            end_date: endDate || 'now',
          },
          total_estimated_cost_usd: Math.round(totalCost * 100) / 100,
          total_tokens: totalTokens,
          by_model: costSummary,
          metadata: {
            generated_at: new Date().toISOString(),
            query_time_ms: Date.now() - startTime,
          },
        };

        res.status(200).json(response);
        break;
      }

      case 'raw': {
        // Return raw analytics data (limited to last 1000 records for safety)
        const rawData = await getAnalyticsSummary(startDate, endDate);
        
        const response = {
          request_id: requestId,
          period: {
            start_date: startDate || 'beginning',
            end_date: endDate || 'now',
          },
          total_records: rawData.length,
          records: rawData.slice(0, 1000), // Limit to 1000 for safety
          metadata: {
            generated_at: new Date().toISOString(),
            query_time_ms: Date.now() - startTime,
            truncated: rawData.length > 1000,
          },
        };

        res.status(200).json(response);
        break;
      }

      default: {
        const errorResponse: ErrorResponse = {
          error: true,
          message: `Invalid type: ${queryType}. Use: summary, performance, cost, or raw`,
          statusCode: 400,
          request_id: requestId,
        };
        res.status(400).json(errorResponse);
        return;
      }
    }

  } catch (error) {
    logger.error(
      'Analytics endpoint error',
      error instanceof Error ? error : new Error(String(error)),
      {
        request_id: requestId,
        ipAddress: Logger.getClientIp(req),
      }
    );

    const errorResponse: ErrorResponse = {
      error: true,
      message: 'Failed to retrieve analytics',
      statusCode: 500,
      request_id: requestId,
    };

    res.status(500).json(errorResponse);
  }
}
