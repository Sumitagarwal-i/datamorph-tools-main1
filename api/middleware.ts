/**
 * Middleware for handling request body parsing with size limits
 * Vercel's default body parser has a 4.5MB limit
 */

import { NowRequest, NowResponse } from '@vercel/node';

/**
 * Parse raw body and handle large payloads
 * This allows us to receive up to 4.5MB of data
 */
export async function parseBody(req: NowRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    
    req.on('data', chunk => {
      data += chunk.toString();
      
      // Safety: reject if data gets too large
      if (data.length > 4.5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    
    req.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    
    req.on('error', reject);
  });
}
