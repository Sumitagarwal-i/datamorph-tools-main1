/**
 * Environment & Secrets Manager
 * Ensures API keys are NEVER exposed to frontend
 * Validates all required environment variables on startup
 */

interface EnvConfig {
  apiUrl: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  cohereApiKey?: string;
  sentryDsn?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  maxRequestSizeMb: number;
  maxTokensPerRequest: number;
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableDetailedLogging: boolean;
  nodeEnv: 'development' | 'production' | 'test';
}

class EnvManager {
  private config: EnvConfig;
  private warnings: string[] = [];
  private errors: string[] = [];

  constructor() {
    this.config = {
      apiUrl: process.env.VITE_API_URL || 'http://localhost:3000',
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      cohereApiKey: process.env.COHERE_API_KEY,
      sentryDsn: process.env.SENTRY_DSN,
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
      maxRequestSizeMb: parseInt(process.env.MAX_REQUEST_SIZE_MB || '1', 10),
      maxTokensPerRequest: parseInt(process.env.MAX_TOKENS_PER_REQUEST || '4000', 10),
      rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '20', 10),
      rateLimitPerHour: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_HOUR || '200', 10),
      logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
      enableDetailedLogging: process.env.ENABLE_DETAILED_LOGGING === 'true',
      nodeEnv: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    };

    this.validate();
  }

  /**
   * Validate environment configuration
   */
  private validate(): void {
    // Check for LLM API keys
    if (!this.config.openaiApiKey && !this.config.anthropicApiKey && !this.config.cohereApiKey) {
      this.warnings.push('⚠️ No LLM API keys configured (OPENAI_API_KEY, ANTHROPIC_API_KEY, COHERE_API_KEY)');
    }

    // Check rate limits sanity
    if (this.config.rateLimitPerMinute <= 0 || this.config.rateLimitPerHour <= 0) {
      this.errors.push('❌ Rate limits must be positive numbers');
    }

    if (this.config.rateLimitPerHour < this.config.rateLimitPerMinute) {
      this.warnings.push('⚠️ rateLimitPerHour should be >= rateLimitPerMinute');
    }

    // Check request size sanity
    if (this.config.maxRequestSizeMb <= 0) {
      this.errors.push('❌ MAX_REQUEST_SIZE_MB must be positive');
    }

    if (this.config.maxTokensPerRequest <= 0) {
      this.errors.push('❌ MAX_TOKENS_PER_REQUEST must be positive');
    }

    // Production checks
    if (this.config.nodeEnv === 'production') {
      if (!this.config.sentryDsn) {
        this.warnings.push('⚠️ SENTRY_DSN not set for production error tracking');
      }
      if (this.config.enableDetailedLogging) {
        this.warnings.push('⚠️ ENABLE_DETAILED_LOGGING=true in production may increase costs');
      }
    }

    // Report
    if (this.errors.length > 0) {
      console.error('❌ Environment validation errors:');
      this.errors.forEach(e => console.error(e));
      throw new Error('Environment configuration invalid. Please check .env');
    }

    if (this.warnings.length > 0) {
      console.warn('⚠️ Environment warnings:');
      this.warnings.forEach(w => console.warn(w));
    }

    console.log('✅ Environment configuration validated');
  }

  /**
   * Get configuration (safe for server-side only)
   */
  getConfig(): EnvConfig {
    return { ...this.config };
  }

  /**
   * Get specific config value
   */
  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.config[key];
  }

  /**
   * Check if LLM is configured
   */
  hasLlmKey(provider: 'openai' | 'anthropic' | 'cohere' = 'openai'): boolean {
    const keyMap = {
      openai: 'openaiApiKey',
      anthropic: 'anthropicApiKey',
      cohere: 'cohereApiKey',
    };
    return !!this.config[keyMap[provider]];
  }

  /**
   * Get API key (never expose to frontend)
   */
  getApiKey(provider: 'openai' | 'anthropic' | 'cohere'): string | undefined {
    if (typeof window !== 'undefined') {
      throw new Error('❌ SECURITY: API keys cannot be accessed from frontend!');
    }
    
    const keyMap = {
      openai: 'openaiApiKey',
      anthropic: 'anthropicApiKey',
      cohere: 'cohereApiKey',
    };
    return this.config[keyMap[provider]];
  }

  /**
   * Log current configuration (hides sensitive data)
   */
  logConfig(): void {
    const safeConfig = {
      ...this.config,
      openaiApiKey: this.config.openaiApiKey ? '***' : undefined,
      anthropicApiKey: this.config.anthropicApiKey ? '***' : undefined,
      cohereApiKey: this.config.cohereApiKey ? '***' : undefined,
      supabaseAnonKey: this.config.supabaseAnonKey ? '***' : undefined,
      sentryDsn: this.config.sentryDsn ? '***' : undefined,
    };
    console.log('📋 Configuration:', JSON.stringify(safeConfig, null, 2));
  }
}

export const envManager = new EnvManager();

/**
 * Helper to ensure API key exists
 */
export function requireApiKey(provider: 'openai' | 'anthropic' | 'cohere'): string {
  const key = envManager.getApiKey(provider);
  if (!key) {
    throw new Error(`${provider.toUpperCase()}_API_KEY not configured in environment variables`);
  }
  return key;
}

