/**
 * GET /api/analyze-status - Health check endpoint
 * Useful for debugging and verifying API is working
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.status(200).json({
    status: 'ok',
    message: 'API is working',
    timestamp: new Date().toISOString(),
    maxPayloadSize: '4.5MB',
    notes: 'Vercel serverless functions have a 4.5MB hard limit on request bodies',
  });
}
