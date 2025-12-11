/**
 * Centralized Logging System
 * Tracks: latency, errors, model used, tokens consumed
 * Supports console logging + Sentry integration
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: Record<string, any>;
  latency?: number; // ms
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  model?: string;
  userId?: string;
  ipAddress?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private logLevel: 'debug' | 'info' | 'warn' | 'error';
  private enableDetailedLogging: boolean;
  private sentryDsn: string | null;

  constructor() {
    this.logLevel = (process.env.LOG_LEVEL as any) || 'info';
    this.enableDetailedLogging = process.env.ENABLE_DETAILED_LOGGING === 'true';
    this.sentryDsn = process.env.SENTRY_DSN || null;
  }

  /**
   * Extract client IP from request (handles proxies)
   */
  static getClientIp(req: VercelRequest): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return (req.socket?.remoteAddress as string) || 'unknown';
  }

  /**
   * Log entry with structured data
   */
  private logStructured(entry: LogEntry): void {
    const logData = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      ...(entry.context && { context: entry.context }),
      ...(entry.latency && { latency: `${entry.latency}ms` }),
      ...(entry.tokens && { tokens: entry.tokens }),
      ...(entry.model && { model: entry.model }),
      ...(entry.userId && { userId: entry.userId }),
      ...(entry.ipAddress && { ipAddress: entry.ipAddress }),
      ...(entry.error && { error: entry.error }),
    };

    // Console logging
    const logMethod = entry.level === 'error' ? console.error : 
                     entry.level === 'warn' ? console.warn : 
                     console.log;
    logMethod(`[${entry.level.toUpperCase()}]`, JSON.stringify(logData, null, 2));

    // TODO: Send to Sentry if configured
    if (this.sentryDsn && entry.level === 'error') {
      this.sendToSentry(entry);
    }

    // TODO: Store in Supabase for analytics
    if (this.enableDetailedLogging) {
      this.storeInDatabase(entry);
    }
  }

  info(message: string, context?: Record<string, any>): void {
    this.logStructured({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
    });
  }

  warn(message: string, context?: Record<string, any>): void {
    this.logStructured({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      context,
    });
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    this.logStructured({
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      context,
    });
  }

  debug(message: string, context?: Record<string, any>): void {
    if (this.logLevel === 'debug') {
      this.logStructured({
        timestamp: new Date().toISOString(),
        level: 'debug',
        message,
        context,
      });
    }
  }

  /**
   * Log API request with latency and token usage
   */
  logApiCall({
    message,
    latency,
    model,
    tokens,
    userId,
    ipAddress,
    context,
  }: {
    message: string;
    latency: number;
    model: string;
    tokens?: { input: number; output: number; total: number };
    userId?: string;
    ipAddress?: string;
    context?: Record<string, any>;
  }): void {
    this.logStructured({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      latency,
      model,
      tokens,
      userId,
      ipAddress,
      context,
    });
  }

  /**
   * Placeholder for Sentry integration
   */
  private sendToSentry(entry: LogEntry): void {
    // Sentry integration would go here
    // Example: Sentry.captureException(entry.error);
    if (this.enableDetailedLogging) {
      console.log('[SENTRY]', entry);
    }
  }

  /**
   * Placeholder for database storage
   */
  private async storeInDatabase(entry: LogEntry): Promise<void> {
    // Store in Supabase or similar
    // Example: await supabase.from('logs').insert([entry]);
    console.log('[DB_LOG]', entry);
  }
}

export const logger = new Logger();
export { Logger };

