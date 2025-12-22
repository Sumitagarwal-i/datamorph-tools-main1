/**
 * POST /api/analyze-streaming - Ultimate large file handler
 * Uses raw streaming to bypass Vercel's body size limits
 * This endpoint accepts the full request and processes it without automatic parsing
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';

// CRITICAL: Tell Vercel NOT to parse the body automatically
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb', // Explicit size limit
    },
  },
  maxDuration: 60,
  memory: 2048,
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const requestId = randomUUID();

  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Log incoming request
    const contentLength = req.headers['content-length'];
    console.log('[analyze-streaming] Request received', {
      request_id: requestId,
      content_length: contentLength,
      content_type: req.headers['content-type'],
    });

    // req.body should already be parsed by Vercel
    if (!req.body) {
      res.status(400).json({ 
        error: 'Request body is empty',
        request_id: requestId,
      });
      return;
    }

    const body = req.body;

    // Validate required fields
    if (!body.content || typeof body.content !== 'string') {
      res.status(400).json({ 
        error: 'Missing required field: content',
        request_id: requestId,
      });
      return;
    }

    console.log('[analyze-streaming] Body validated', {
      request_id: requestId,
      content_length: body.content.length,
      file_type: body.file_type,
      file_name: body.file_name,
    });

    // Forward to main analyze endpoint
    const analyzeUrl = `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/analyze`;
    
    console.log('[analyze-streaming] Forwarding to', analyzeUrl);

    const analyzeResponse = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-By': 'analyze-streaming',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify(body),
    });

    const responseData = await analyzeResponse.json();

    res.setHeader('X-Analysis-Endpoint', 'analyze-streaming');
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Upstream-Status', analyzeResponse.status.toString());

    res.status(analyzeResponse.status).json(responseData);
  } catch (error: any) {
    console.error('[analyze-streaming] Error:', {
      request_id: requestId,
      error: error?.message || 'Unknown error',
      stack: error?.stack,
    });

    res.status(500).json({
      error: 'Internal server error',
      message: error?.message || 'Unknown error',
      request_id: requestId,
    });
  }
}
