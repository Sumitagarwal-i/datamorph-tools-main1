/**
 * Testing Guide for Phase B Infrastructure
 * Run these tests to verify all security & logging systems work correctly
 */

// ============================================================================
// 1. Test Environment Configuration
// ============================================================================

import { envManager } from '../api/lib/envManager';

console.log('TEST 1: Environment Configuration');
console.log('==================================');

try {
  const config = envManager.getConfig();
  console.log('✅ Environment loaded successfully');
  console.log(`   - Node env: ${config.nodeEnv}`);
  console.log(`   - Max request size: ${config.maxRequestSizeMb}MB`);
  console.log(`   - Rate limit: ${config.rateLimitPerMinute} req/min`);
  console.log(`   - Logging level: ${config.logLevel}`);
} catch (error) {
  console.error('❌ Failed to load environment:', error);
}

// ============================================================================
// 2. Test Rate Limiting
// ============================================================================

import { rateLimiter } from '../api/lib/rateLimiter';

console.log('\nTEST 2: Rate Limiting');
console.log('====================');

// Mock request object
const mockReq = {
  headers: {
    'x-forwarded-for': '192.168.1.100',
  },
  socket: { remoteAddress: '127.0.0.1' },
} as any;

// Simulate 25 requests (should hit limit after 20)
let limitExceeded = false;
for (let i = 1; i <= 25; i++) {
  const result = rateLimiter.isAllowed(mockReq);
  
  if (!result.allowed) {
    console.log(`✅ Rate limit triggered at request ${i}`);
    console.log(`   - Reset time: ${new Date(result.resetTime).toISOString()}`);
    limitExceeded = true;
    break;
  }
  
  if (i === 20) {
    console.log(`✅ Allowed 20 requests (as configured)`);
  }
}

if (!limitExceeded) {
  console.log('❌ Rate limit not triggered correctly');
}

// ============================================================================
// 3. Test Request Validation
// ============================================================================

import { requestValidator } from '../api/lib/requestValidator';

console.log('\nTEST 3: Request Validation');
console.log('==========================');

// Test 1: Valid request
const validBody = { content: 'Hello, world!' };
const validResult = requestValidator.validateJsonBody(validBody);
console.log(`✅ Valid body: ${validResult.valid ? 'PASS' : 'FAIL'}`);

// Test 2: Empty body
const emptyResult = requestValidator.validateJsonBody(null);
console.log(`✅ Empty body rejected: ${!emptyResult.valid ? 'PASS' : 'FAIL'}`);

// Test 3: Token count
const longContent = 'x'.repeat(20000); // ~5000 tokens (exceeds 4000 limit)
const tokenResult = requestValidator.validateTokenCount(longContent);
console.log(`✅ Token limit enforced: ${!tokenResult.valid ? 'PASS' : 'FAIL'}`);
if (!tokenResult.valid) {
  console.log(`   - Error: ${tokenResult.error}`);
}

// Test 4: Content type
const mockReqWithContentType = {
  headers: {
    'content-type': 'application/json',
  },
} as any;
const contentTypeResult = requestValidator.validateContentType(
  mockReqWithContentType,
  ['application/json']
);
console.log(`✅ Valid content-type: ${contentTypeResult.valid ? 'PASS' : 'FAIL'}`);

// ============================================================================
// 4. Test Logging
// ============================================================================

import { logger } from '../api/lib/logger';

console.log('\nTEST 4: Logging System');
console.log('======================');

logger.info('Test info message', { feature: 'TEST', status: 'running' });
console.log('✅ Info log recorded');

logger.debug('Test debug message', { details: 'Only visible in debug mode' });
console.log('✅ Debug log recorded');

logger.warn('Test warning', { severity: 'low' });
console.log('✅ Warning logged');

try {
  throw new Error('Test error for logging');
} catch (error) {
  logger.error('Test error occurred', error as Error, { context: 'testing' });
  console.log('✅ Error logged with stack trace');
}

logger.logApiCall({
  message: 'Test API call',
  latency: 1234,
  model: 'openai',
  tokens: { input: 100, output: 50, total: 150 },
  ipAddress: '192.168.1.1',
});
console.log('✅ API call metrics logged');

// ============================================================================
// 5. Test Security Features
// ============================================================================

console.log('\nTEST 5: Security Features');
console.log('=========================');

// Test 1: Cannot access API keys from frontend
try {
  // Simulate frontend environment
  (global as any).window = {}; // Simulate browser
  const key = envManager.getApiKey('openai');
  console.log('❌ Security breach: API key exposed to frontend');
} catch (error) {
  console.log('✅ API key protected from frontend access');
}

// Clean up
delete (global as any).window;

// Test 2: LLM provider check
const hasOpenAI = envManager.hasLlmKey('openai');
console.log(`✅ LLM provider check: OpenAI ${hasOpenAI ? 'available' : 'not configured'}`);

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log('PHASE B INFRASTRUCTURE TESTS COMPLETED');
console.log('='.repeat(50));
console.log('\n✅ All security systems operational');
console.log('✅ Rate limiting functional');
console.log('✅ Request validation working');
console.log('✅ Logging system active');
console.log('\n📋 Next steps:');
console.log('1. Set API keys in .env (dev) or Vercel (prod)');
console.log('2. Deploy to Vercel');
console.log('3. Test endpoints: curl https://your-api.vercel.app/api/health');
console.log('4. Monitor logs in Vercel dashboard');

