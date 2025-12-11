/**
 * Cache Manager for Detective D
 * 
 * Implements content-based caching with Redis for cost optimization:
 * - SHA256 content hashing for deduplication
 * - Cache lookup with hash + max_errors
 * - TTL-based expiration (24 hours default)
 * - Model/RAG version-aware invalidation
 * - Both full results and streaming snapshot caching
 */

import { createHash } from 'crypto';
import { logger } from './logger.js';

// ============================================================================
// Types
// ============================================================================

export interface CacheKey {
  content_hash: string;
  max_errors: number;
  file_type: string;
}

export interface CacheEntry {
  request_id: string;
  cache_key: CacheKey;
  response: any;
  model: string;
  model_version: string;
  rag_version: string;
  created_at: number;
  ttl_seconds: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  invalidations: number;
  total_requests: number;
  hit_rate: number;
}

// ============================================================================
// Configuration
// ============================================================================

const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false';
const CACHE_TTL_SECONDS = parseInt(process.env.CACHE_TTL_SECONDS || '86400'); // 24 hours
const CACHE_PREFIX = 'detective-d:cache:';
const STATS_KEY = 'detective-d:cache:stats';
const VERSION_KEY = 'detective-d:versions';

// Model and RAG versions for cache invalidation
const MODEL_VERSION = 'llama-3.1-8b-instant-v1';
const RAG_VERSION = process.env.RAG_VERSION || '1.0.0'; // Increment when RAG content changes

// ============================================================================
// In-Memory Cache (Fallback when Redis unavailable)
// ============================================================================

interface InMemoryEntry {
  data: CacheEntry;
  expires_at: number;
}

const inMemoryCache = new Map<string, InMemoryEntry>();
const inMemoryStats = {
  hits: 0,
  misses: 0,
  invalidations: 0,
  total_requests: 0,
};

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, entry] of inMemoryCache.entries()) {
    if (entry.expires_at < now) {
      inMemoryCache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug('Cleaned expired in-memory cache entries', { cleaned });
  }
}, 5 * 60 * 1000);

// ============================================================================
// Redis Client (Optional)
// ============================================================================

let redisClient: any = null;
let redisAvailable = false;

/**
 * Initialize Redis client if available
 */
async function initializeRedis(): Promise<void> {
  if (!CACHE_ENABLED) {
    logger.info('Cache disabled via CACHE_ENABLED=false');
    return;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.info('Redis not configured, using in-memory cache fallback');
    return;
  }

  try {
    // Try to import redis (optional dependency)
    let redis: any;
    try {
      redis = await import('redis');
    } catch (importError) {
      throw new Error('Redis module not found - install with: npm install redis');
    }
    
    redisClient = redis.createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries: number) => {
          if (retries > 3) {
            logger.warn('Redis reconnect failed, switching to in-memory cache');
            redisAvailable = false;
            return false;
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on('error', (err: Error) => {
      logger.error('Redis client error', err, {
        switching_to_memory: true,
      });
      redisAvailable = false;
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
      redisAvailable = true;
    });

    await redisClient.connect();
  } catch (error) {
    logger.warn('Redis initialization failed, using in-memory cache', {
      error: error instanceof Error ? error.message : String(error),
    });
    redisClient = null;
    redisAvailable = false;
  }
}

// Initialize on module load
initializeRedis().catch(err => {
  logger.error('Failed to initialize Redis', err);
});

// ============================================================================
// Content Hashing
// ============================================================================

/**
 * Compute SHA256 hash of content
 */
export function computeContentHash(content: string): string {
  return createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 16); // Use first 16 chars for shorter keys
}

/**
 * Generate cache key from content hash and parameters
 */
export function generateCacheKey(
  contentHash: string,
  maxErrors: number,
  fileType: string
): string {
  return `${CACHE_PREFIX}${fileType}:${contentHash}:${maxErrors}`;
}

// ============================================================================
// Cache Operations (Abstracted)
// ============================================================================

/**
 * Get value from cache (Redis or in-memory)
 */
async function getCacheValue(key: string): Promise<string | null> {
  if (redisAvailable && redisClient) {
    try {
      return await redisClient.get(key);
    } catch (error) {
      logger.warn('Redis get failed, falling back to memory', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      redisAvailable = false;
    }
  }

  // Fallback to in-memory
  const entry = inMemoryCache.get(key);
  if (entry) {
    if (entry.expires_at > Date.now()) {
      return JSON.stringify(entry.data);
    } else {
      inMemoryCache.delete(key);
    }
  }
  
  return null;
}

/**
 * Set value in cache (Redis or in-memory)
 */
async function setCacheValue(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  if (redisAvailable && redisClient) {
    try {
      await redisClient.setEx(key, ttlSeconds, value);
      return;
    } catch (error) {
      logger.warn('Redis set failed, falling back to memory', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      redisAvailable = false;
    }
  }

  // Fallback to in-memory
  inMemoryCache.set(key, {
    data: JSON.parse(value),
    expires_at: Date.now() + (ttlSeconds * 1000),
  });
}

/**
 * Delete value from cache (Redis or in-memory)
 */
async function deleteCacheValue(key: string): Promise<void> {
  if (redisAvailable && redisClient) {
    try {
      await redisClient.del(key);
      return;
    } catch (error) {
      logger.warn('Redis delete failed, falling back to memory', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback to in-memory
  inMemoryCache.delete(key);
}

/**
 * Increment counter (Redis or in-memory)
 */
async function incrementCounter(key: string, field: string): Promise<void> {
  if (redisAvailable && redisClient) {
    try {
      await redisClient.hIncrBy(key, field, 1);
      return;
    } catch (error) {
      logger.warn('Redis increment failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback to in-memory stats
  if (field === 'hits') inMemoryStats.hits++;
  else if (field === 'misses') inMemoryStats.misses++;
  else if (field === 'invalidations') inMemoryStats.invalidations++;
  else if (field === 'total_requests') inMemoryStats.total_requests++;
}

// ============================================================================
// Version Management
// ============================================================================

/**
 * Get current versions (model, RAG)
 */
async function getCurrentVersions(): Promise<{
  model_version: string;
  rag_version: string;
}> {
  if (redisAvailable && redisClient) {
    try {
      const versions = await redisClient.hGetAll(VERSION_KEY);
      return {
        model_version: versions.model_version || MODEL_VERSION,
        rag_version: versions.rag_version || RAG_VERSION,
      };
    } catch (error) {
      logger.warn('Failed to get versions from Redis', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback to environment
  return {
    model_version: MODEL_VERSION,
    rag_version: RAG_VERSION,
  };
}

/**
 * Update version in cache (triggers invalidation)
 */
export async function updateVersion(
  type: 'model' | 'rag',
  version: string
): Promise<void> {
  const field = `${type}_version`;
  
  if (redisAvailable && redisClient) {
    try {
      await redisClient.hSet(VERSION_KEY, field, version);
      logger.info('Version updated, cache will invalidate on next lookup', {
        type,
        version,
      });
      return;
    } catch (error) {
      logger.error('Failed to update version', error instanceof Error ? error : new Error(String(error)));
    }
  }

  // In-memory: just log (cache will use env vars)
  logger.info('Version updated (in-memory mode)', { type, version });
}

// ============================================================================
// Cache Lookup
// ============================================================================

/**
 * Look up cached analysis result
 */
export async function getCachedAnalysis(
  content: string,
  maxErrors: number,
  fileType: string,
  requestId: string
): Promise<any | null> {
  if (!CACHE_ENABLED) {
    return null;
  }

  try {
    // Compute content hash
    const contentHash = computeContentHash(content);
    const cacheKey = generateCacheKey(contentHash, maxErrors, fileType);

    logger.debug('Cache lookup', {
      request_id: requestId,
      cache_key: cacheKey,
      content_hash: contentHash,
    });

    // Update stats
    await incrementCounter(STATS_KEY, 'total_requests');

    // Get cached entry
    const cachedValue = await getCacheValue(cacheKey);
    
    if (!cachedValue) {
      logger.debug('Cache miss', { request_id: requestId, cache_key: cacheKey });
      await incrementCounter(STATS_KEY, 'misses');
      return null;
    }

    const cachedEntry: CacheEntry = JSON.parse(cachedValue);

    // Check if entry is expired (shouldn't happen with TTL, but defensive)
    const age = Date.now() - cachedEntry.created_at;
    if (age > cachedEntry.ttl_seconds * 1000) {
      logger.debug('Cache entry expired', {
        request_id: requestId,
        age_seconds: Math.floor(age / 1000),
      });
      await deleteCacheValue(cacheKey);
      await incrementCounter(STATS_KEY, 'misses');
      return null;
    }

    // Check version compatibility
    const currentVersions = await getCurrentVersions();
    
    if (
      cachedEntry.model_version !== currentVersions.model_version ||
      cachedEntry.rag_version !== currentVersions.rag_version
    ) {
      logger.info('Cache invalidated due to version mismatch', {
        request_id: requestId,
        cached_model: cachedEntry.model_version,
        current_model: currentVersions.model_version,
        cached_rag: cachedEntry.rag_version,
        current_rag: currentVersions.rag_version,
      });
      
      await deleteCacheValue(cacheKey);
      await incrementCounter(STATS_KEY, 'invalidations');
      await incrementCounter(STATS_KEY, 'misses');
      return null;
    }

    // Cache hit!
    logger.info('Cache hit', {
      request_id: requestId,
      cache_key: cacheKey,
      age_seconds: Math.floor(age / 1000),
      original_request_id: cachedEntry.request_id,
    });
    
    await incrementCounter(STATS_KEY, 'hits');

    // Return cached response
    return cachedEntry.response;
  } catch (error) {
    logger.error('Cache lookup failed', error instanceof Error ? error : new Error(String(error)), {
      request_id: requestId,
    });
    return null;
  }
}

// ============================================================================
// Cache Storage
// ============================================================================

/**
 * Store analysis result in cache
 */
export async function cacheAnalysisResult(
  content: string,
  maxErrors: number,
  fileType: string,
  response: any,
  requestId: string,
  model: string = 'llama-3.1-8b-instant'
): Promise<void> {
  if (!CACHE_ENABLED) {
    return;
  }

  try {
    // Compute content hash
    const contentHash = computeContentHash(content);
    const cacheKey = generateCacheKey(contentHash, maxErrors, fileType);

    // Get current versions
    const currentVersions = await getCurrentVersions();

    // Build cache entry
    const cacheEntry: CacheEntry = {
      request_id: requestId,
      cache_key: {
        content_hash: contentHash,
        max_errors: maxErrors,
        file_type: fileType,
      },
      response,
      model,
      model_version: currentVersions.model_version,
      rag_version: currentVersions.rag_version,
      created_at: Date.now(),
      ttl_seconds: CACHE_TTL_SECONDS,
    };

    // Store in cache
    await setCacheValue(cacheKey, JSON.stringify(cacheEntry), CACHE_TTL_SECONDS);

    logger.info('Analysis result cached', {
      request_id: requestId,
      cache_key: cacheKey,
      ttl_seconds: CACHE_TTL_SECONDS,
    });
  } catch (error) {
    logger.error('Failed to cache analysis result', error instanceof Error ? error : new Error(String(error)), {
      request_id: requestId,
    });
  }
}

// ============================================================================
// Cache Statistics
// ============================================================================

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  if (redisAvailable && redisClient) {
    try {
      const stats = await redisClient.hGetAll(STATS_KEY);
      const hits = parseInt(stats.hits || '0');
      const misses = parseInt(stats.misses || '0');
      const total = hits + misses;
      
      return {
        hits,
        misses,
        invalidations: parseInt(stats.invalidations || '0'),
        total_requests: parseInt(stats.total_requests || '0'),
        hit_rate: total > 0 ? hits / total : 0,
      };
    } catch (error) {
      logger.warn('Failed to get cache stats from Redis', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback to in-memory stats
  const total = inMemoryStats.hits + inMemoryStats.misses;
  return {
    hits: inMemoryStats.hits,
    misses: inMemoryStats.misses,
    invalidations: inMemoryStats.invalidations,
    total_requests: inMemoryStats.total_requests,
    hit_rate: total > 0 ? inMemoryStats.hits / total : 0,
  };
}

/**
 * Reset cache statistics
 */
export async function resetCacheStats(): Promise<void> {
  if (redisAvailable && redisClient) {
    try {
      await redisClient.del(STATS_KEY);
      logger.info('Cache stats reset');
      return;
    } catch (error) {
      logger.warn('Failed to reset Redis cache stats', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Reset in-memory stats
  inMemoryStats.hits = 0;
  inMemoryStats.misses = 0;
  inMemoryStats.invalidations = 0;
  inMemoryStats.total_requests = 0;
  logger.info('In-memory cache stats reset');
}

// ============================================================================
// Cache Invalidation
// ============================================================================

/**
 * Invalidate all cache entries (use when RAG or model changes)
 */
export async function invalidateAllCache(): Promise<number> {
  let deleted = 0;

  if (redisAvailable && redisClient) {
    try {
      // Get all cache keys
      const keys = await redisClient.keys(`${CACHE_PREFIX}*`);
      
      if (keys.length > 0) {
        deleted = await redisClient.del(keys);
      }
      
      logger.info('All cache entries invalidated', { deleted });
      return deleted;
    } catch (error) {
      logger.error('Failed to invalidate Redis cache', error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Clear in-memory cache
  deleted = inMemoryCache.size;
  inMemoryCache.clear();
  logger.info('In-memory cache cleared', { deleted });
  
  return deleted;
}

/**
 * Invalidate cache entries for specific file type
 */
export async function invalidateCacheByFileType(fileType: string): Promise<number> {
  let deleted = 0;

  if (redisAvailable && redisClient) {
    try {
      const keys = await redisClient.keys(`${CACHE_PREFIX}${fileType}:*`);
      
      if (keys.length > 0) {
        deleted = await redisClient.del(keys);
      }
      
      logger.info('Cache entries invalidated for file type', {
        file_type: fileType,
        deleted,
      });
      return deleted;
    } catch (error) {
      logger.error('Failed to invalidate cache by file type', error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Clear matching in-memory entries
  const prefix = `${CACHE_PREFIX}${fileType}:`;
  for (const key of inMemoryCache.keys()) {
    if (key.startsWith(prefix)) {
      inMemoryCache.delete(key);
      deleted++;
    }
  }
  
  logger.info('In-memory cache entries cleared for file type', {
    file_type: fileType,
    deleted,
  });
  
  return deleted;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  computeContentHash,
  generateCacheKey,
  getCachedAnalysis,
  cacheAnalysisResult,
  getCacheStats,
  resetCacheStats,
  invalidateAllCache,
  invalidateCacheByFileType,
  updateVersion,
};

