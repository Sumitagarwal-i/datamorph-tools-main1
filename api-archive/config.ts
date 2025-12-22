/**
 * Configuration for Vercel serverless functions
 * This file is picked up by Vercel during deployment
 */

// Ensure large payloads are handled properly
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb', // Match Vercel's hard limit
    },
  },
};

export default function noop() {}
