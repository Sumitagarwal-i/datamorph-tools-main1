/**
 * Vercel serverless function configuration for larger payloads
 * This tells Vercel to use a larger memory allocation and longer timeout
 */

export const config = {
  // Allocate more memory for processing larger files
  memory: 3008,
  // Increase timeout to 60 seconds for complex analysis
  maxDuration: 60,
  // This is KEY: Vercel will automatically parse larger bodies with this setting
};
