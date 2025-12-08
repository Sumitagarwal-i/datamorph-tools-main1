/**
 * POST /api/cache-invalidate - Cache invalidation endpoint
 * Allows selective or complete cache invalidation
 * 
 * Body:
 * - { "scope": "all" } - Invalidate all cache
 * - { "scope": "file_type", "file_type": "json" } - Invalidate by file type
 * - { "scope": "version", "type": "model"|"rag", "version": "..." } - Update version (triggers invalidation)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { invalidateAllCache, invalidateCacheByFileType, updateVersion } from './lib/cacheManager';
import { logger, Logger } from './lib/logger';
import { randomUUID } from 'crypto';

interface InvalidateRequest {
  scope: 'all' | 'file_type' | 'version';
  file_type?: string;
  type?: 'model' | 'rag';
  version?: string;
}

interface InvalidateResponse {
  success: boolean;
  scope: string;
  deleted_entries?: number;
  file_type?: string;
  version_updated?: {
    type: string;
    version: string;
  };
  request_id: string;
}

interface ErrorResponse {
  error: true;
  message: string;
  statusCode: number;
  request_id: string;
  fix?: string;
}

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const requestId = randomUUID();
  let response: any = { success: false, error: 'Unknown error' };

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      const errorResponse: ErrorResponse = {
        error: true,
        message: 'Method not allowed',
        statusCode: 405,
        request_id: requestId,
      };
      res.status(405).json(errorResponse);
    }

    // Verify admin API key (if configured)
    if (ADMIN_API_KEY) {
      const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      
      if (!providedKey || providedKey !== ADMIN_API_KEY) {
        logger.warn('Unauthorized cache invalidation attempt', {
          request_id: requestId,
          ipAddress: Logger.getClientIp(req),
        });

        const errorResponse: ErrorResponse = {
          error: true,
          message: 'Unauthorized',
          statusCode: 401,
          request_id: requestId,
          fix: 'Provide valid admin API key via X-API-Key header',
        };

        res.status(401).json(errorResponse);
      }
    }

    // Validate request body
    const body = req.body as InvalidateRequest;
    
    if (!body || typeof body !== 'object') {
      const errorResponse: ErrorResponse = {
        error: true,
        message: 'Invalid request body',
        statusCode: 400,
        request_id: requestId,
        fix: 'Send JSON body with { scope: "all" | "file_type" | "version", ... }',
      };
      res.status(400).json(errorResponse);
    }

    if (!body.scope) {
      const errorResponse: ErrorResponse = {
        error: true,
        message: 'Missing required field: scope',
        statusCode: 400,
        request_id: requestId,
        fix: 'Specify scope: "all", "file_type", or "version"',
      };
      res.status(400).json(errorResponse);
    }

    // Handle different invalidation scopes
    let response: InvalidateResponse;

    switch (body.scope) {
      case 'all': {
        // Invalidate all cache entries
        const deleted = await invalidateAllCache();
        
        response = {
          success: true,
          scope: 'all',
          deleted_entries: deleted,
          request_id: requestId,
        };

        logger.info('All cache invalidated', {
          request_id: requestId,
          deleted_entries: deleted,
          ipAddress: Logger.getClientIp(req),
        });

        break;
      }

      case 'file_type': {
        // Invalidate by file type
        if (!body.file_type) {
          const errorResponse: ErrorResponse = {
            error: true,
            message: 'Missing required field: file_type',
            statusCode: 400,
            request_id: requestId,
            fix: 'Specify file_type: "json", "csv", "xml", or "yaml"',
          };
          res.status(400).json(errorResponse);
        }

        const validTypes = ['json', 'csv', 'xml', 'yaml'];
        if (!body.file_type || !validTypes.includes(body.file_type)) {
          const errorResponse: ErrorResponse = {
            error: true,
            message: `Invalid file_type: ${body.file_type}`,
            statusCode: 400,
            request_id: requestId,
            fix: `Use one of: ${validTypes.join(', ')}`,
          };
          res.status(400).json(errorResponse);
          return;
        }

        const deleted = await invalidateCacheByFileType(body.file_type!);
        
        response = {
          success: true,
          scope: 'file_type',
          file_type: body.file_type,
          deleted_entries: deleted,
          request_id: requestId,
        };

        logger.info('Cache invalidated by file type', {
          request_id: requestId,
          file_type: body.file_type,
          deleted_entries: deleted,
          ipAddress: Logger.getClientIp(req),
        });

        break;
      }

      case 'version': {
        // Update version (triggers invalidation on next lookup)
        if (!body.type || !body.version) {
          const errorResponse: ErrorResponse = {
            error: true,
            message: 'Missing required fields: type and version',
            statusCode: 400,
            request_id: requestId,
            fix: 'Specify type: "model"|"rag" and version: "..."',
          };
          res.status(400).json(errorResponse);
        }

        if (body.type !== 'model' && body.type !== 'rag') {
          const errorResponse: ErrorResponse = {
            error: true,
            message: `Invalid type: ${body.type}`,
            statusCode: 400,
            request_id: requestId,
            fix: 'Use type: "model" or "rag"',
          };
          res.status(400).json(errorResponse);
        }

        if (!body.type || !body.version) {
          const errorResponse: ErrorResponse = {
            error: true,
            message: 'Missing type or version',
            statusCode: 400,
            request_id: requestId,
          };
          res.status(400).json(errorResponse);
          return;
        }
        await updateVersion(body.type as 'model' | 'rag', body.version);
        
        response = {
          success: true,
          scope: 'version',
          version_updated: {
            type: body.type!,
            version: body.version!,
          },
          request_id: requestId,
        };

        logger.info('Version updated (cache will invalidate)', {
          request_id: requestId,
          type: body.type,
          version: body.version,
          ipAddress: Logger.getClientIp(req),
        });

        break;
      }

      default: {
        const errorResponse: ErrorResponse = {
          error: true,
          message: `Invalid scope: ${body.scope}`,
          statusCode: 400,
          request_id: requestId,
          fix: 'Use scope: "all", "file_type", or "version"',
        };
        res.status(400).json(errorResponse);
        return;
      }
    }

    res.setHeader('X-Request-ID', requestId);
    res.status(200).json(response);
  } catch (error) {
    logger.error('Cache invalidation failed', error instanceof Error ? error : new Error(String(error)), {
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


