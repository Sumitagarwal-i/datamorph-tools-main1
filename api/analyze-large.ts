/**
 * POST /api/analyze-large - Alternative endpoint for large file analysis
 * Uses raw request body handling to bypass Vercel's automatic body parser
 * This helps avoid 413 errors on the main /api/analyze endpoint
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';

// This tells Vercel to NOT automatically parse the body
export const config = {
  api: {
    bodyParser: false, // Disable automatic body parsing
  },
  memory: 3008,
  maxDuration: 60,
};

// Helper to read raw body
async function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    
    req.on('data', (chunk: any) => {
      chunks.push(chunk);
    });
    
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    
    req.on('error', (error) => {
      reject(error);
    });
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const requestId = randomUUID();

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Get raw body
    const rawBody = await getRawBody(req);
    
    // Parse JSON
    let parsedBody: any;
    try {
      const bodyString = rawBody.toString('utf-8');
      parsedBody = JSON.parse(bodyString);
    } catch (parseError) {
      res.status(400).json({ 
        error: 'Invalid JSON in request body',
        request_id: requestId,
      });
      return;
    }

    // Log request details
    console.log('[analyze-large] Request received', {
      request_id: requestId,
      body_size_kb: (rawBody.length / 1024).toFixed(2),
      content_type: req.headers['content-type'],
      file_type: parsedBody.file_type,
      file_name: parsedBody.file_name,
      content_length: parsedBody.content?.length || 0,
    });

    // Validate request
    if (!parsedBody.content || typeof parsedBody.content !== 'string') {
      res.status(400).json({ 
        error: 'Missing or invalid content field',
        request_id: requestId,
      });
      return;
    }

    // Forward to main analyze endpoint with parsed body
    // by making an internal request with the parsed data
    const analyzeResponse = await fetch(
      `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/analyze`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-By': 'analyze-large',
        },
        body: JSON.stringify(parsedBody),
      }
    );

    if (!analyzeResponse.ok) {
      const errorData = await analyzeResponse.json();
      res.status(analyzeResponse.status).json(errorData);
      return;
    }

    const result = await analyzeResponse.json();
    
    // Add header to indicate this came through the large-file endpoint
    res.setHeader('X-Analysis-Endpoint', 'analyze-large');
    res.setHeader('X-Request-ID', requestId);
    
    res.status(200).json(result);
  } catch (error: any) {
    console.error('[analyze-large] Error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: error?.message || 'Unknown error',
      request_id: requestId,
    });
  }
}
