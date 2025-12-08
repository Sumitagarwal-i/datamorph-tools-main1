/**
 * Rate Limiting System
 * Supports per-IP and per-user rate limiting
 * Configurable limits: 1 request per 5s, 50 requests per hour
 */

import type { VercelRequest } from '@vercel/node';
import { logger, Logger } from './logger';

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor() {
    this.config = {
      requestsPerMinute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '20', 10),
      requestsPerHour: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_HOUR || '200', 10),
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    };

    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Generate rate limit key from request
   * Priority: user ID > IP address
   */
  private getKey(req: VercelRequest, userId?: string): string {
    if (userId) return `user:${userId}`;
    const ip = Logger.getClientIp(req);
    return `ip:${ip}`;
  }

  /**
   * Check if request is within rate limits
   */
  isAllowed(req: VercelRequest, userId?: string): { allowed: boolean; remaining: number; resetTime: number } {
    const key = this.getKey(req, userId);
    const now = Date.now();
    const entry = this.store.get(key);

    // First request or window expired
    if (!entry || now >= entry.resetTime) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + this.config.windowMs,
      };
      this.store.set(key, newEntry);
      return {
        allowed: true,
        remaining: this.config.requestsPerMinute - 1,
        resetTime: newEntry.resetTime,
      };
    }

    // Check if over limit
    const isOverLimit = entry.count >= this.config.requestsPerMinute;
    if (isOverLimit) {
      logger.warn('Rate limit exceeded', {
        key,
        count: entry.count,
        limit: this.config.requestsPerMinute,
        resetTime: new Date(entry.resetTime).toISOString(),
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment and allow
    entry.count++;
    return {
      allowed: true,
      remaining: this.config.requestsPerMinute - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Rate limiter cleanup: removed ${cleaned} expired entries`, {
        totalEntries: this.store.size,
      });
    }
  }

  /**
   * Get current stats
   */
  getStats(req: VercelRequest, userId?: string) {
    const key = this.getKey(req, userId);
    const entry = this.store.get(key);

    if (!entry) {
      return {
        used: 0,
        limit: this.config.requestsPerMinute,
        remaining: this.config.requestsPerMinute,
        resetTime: Date.now() + this.config.windowMs,
      };
    }

    return {
      used: entry.count,
      limit: this.config.requestsPerMinute,
      remaining: Math.max(0, this.config.requestsPerMinute - entry.count),
      resetTime: entry.resetTime,
    };
  }
}

export const rateLimiter = new RateLimiter();

