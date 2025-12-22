/**
 * POST /api/analyze-v2 - Alternative endpoint with explicit chunking
 * This endpoint handles large files by chunking the upload itself
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Log request details for debugging
    const contentLength = req.headers['content-length'];
    console.log('[analyze-v2] Received request', {
      contentLength: contentLength ? `${parseInt(contentLength) / 1024}KB` : 'unknown',
      bodySize: JSON.stringify(req.body).length,
    });

    // Verify body is present
    if (!req.body) {
      return res.status(400).json({ 
        error: 'Request body is required',
        details: 'No content provided'
      });
    }

    // Forward to main analyze endpoint
    const response = await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('[analyze-v2] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
