/**
 * Telemetry & Analytics Logger
 * 
 * Records anonymized request metrics to Supabase for:
 * - Usage analytics
 * - Cost tracking (tokens, model usage)
 * - Performance monitoring (latency, errors)
 * - Trend analysis
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger.js';

// Supabase client for analytics
let supabase: SupabaseClient | null = null;

// Initialize Supabase client
function getSupabaseClient(): SupabaseClient | null {
  if (supabase) return supabase;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    logger.warn('Supabase not configured for telemetry - metrics will be logged locally only');
    return null;
  }

  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    return supabase;
  } catch (error) {
    logger.error('Failed to initialize Supabase for telemetry', error instanceof Error ? error : undefined);
    return null;
  }
}

/**
 * Telemetry record structure
 */
export interface TelemetryRecord {
  request_id: string;
  timestamp: string;
  
  // Request metadata
  file_type: string;
  content_length: number;
  was_truncated: boolean;
  max_errors_requested?: number;
  
  // LLM info
  llm_provider?: string;
  llm_model?: string;
  tokens_used?: number;
  
  // Performance metrics
  latency_ms: number;
  cache_hit?: boolean;
  
  // Results
  total_errors: number;
  total_warnings: number;
  success: boolean;
  error_type?: string;
  
  // Safety & quality
  sanity_checks_passed?: number;
  sanity_checks_failed?: number;
  
  // RAG usage
  rag_snippets_used?: number;
  
  // Optional metadata (anonymized)
  user_agent?: string;
  country?: string;
}

/**
 * Cost tracking by model
 */
interface ModelCosts {
  'llama-3.1-8b-instant': { input: number; output: number };
  'gpt-4': { input: number; output: number };
  'gpt-3.5-turbo': { input: number; output: number };
  [key: string]: { input: number; output: number };
}

// Approximate costs per 1M tokens (update as needed)
const MODEL_COSTS: ModelCosts = {
  'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },  // Groq pricing
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
};

/**
 * Calculate cost for a request
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const costs = MODEL_COSTS[model] || { input: 0, output: 0 };
  const inputCost = (promptTokens / 1_000_000) * costs.input;
  const outputCost = (completionTokens / 1_000_000) * costs.output;
  return inputCost + outputCost;
}

/**
 * Log telemetry record to Supabase (async, non-blocking)
 */
export async function logTelemetry(record: TelemetryRecord): Promise<void> {
  // Always log locally for debugging
  logger.info('Telemetry', {
    request_id: record.request_id,
    file_type: record.file_type,
    latency_ms: record.latency_ms,
    success: record.success,
    tokens_used: record.tokens_used,
    cache_hit: record.cache_hit,
  });

  // Try to log to Supabase asynchronously
  const client = getSupabaseClient();
  if (!client) {
    return; // Supabase not configured, already logged locally
  }

  try {
    const { error } = await client
      .from('analytics_requests')
      .insert([{
        request_id: record.request_id,
        timestamp: record.timestamp,
        file_type: record.file_type,
        content_length: record.content_length,
        was_truncated: record.was_truncated,
        max_errors_requested: record.max_errors_requested,
        llm_provider: record.llm_provider,
        llm_model: record.llm_model,
        tokens_used: record.tokens_used,
        latency_ms: record.latency_ms,
        cache_hit: record.cache_hit,
        total_errors: record.total_errors,
        total_warnings: record.total_warnings,
        success: record.success,
        error_type: record.error_type,
        sanity_checks_passed: record.sanity_checks_passed,
        sanity_checks_failed: record.sanity_checks_failed,
        rag_snippets_used: record.rag_snippets_used,
        user_agent: record.user_agent,
        country: record.country,
      }]);

    if (error) {
      logger.warn('Failed to log telemetry to Supabase', {
        request_id: record.request_id,
        error: error.message,
      });
    }
  } catch (error) {
    logger.warn('Telemetry logging error', {
      request_id: record.request_id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Log telemetry in background (fire and forget)
 * Use this in API handlers to avoid blocking response
 */
export function logTelemetryAsync(record: TelemetryRecord): void {
  // Fire and forget - don't await
  logTelemetry(record).catch((error) => {
    logger.warn('Background telemetry logging failed', {
      request_id: record.request_id,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * Get analytics summary (for admin dashboard)
 */
export async function getAnalyticsSummary(
  startDate?: string,
  endDate?: string
): Promise<any> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase not configured');
  }

  let query = client
    .from('analytics_requests')
    .select('*');

  if (startDate) {
    query = query.gte('timestamp', startDate);
  }
  if (endDate) {
    query = query.lte('timestamp', endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch analytics: ${error.message}`);
  }

  return data;
}

/**
 * Get cost summary by model
 */
export async function getCostSummary(
  startDate?: string,
  endDate?: string
): Promise<{ model: string; total_tokens: number; estimated_cost: number }[]> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase not configured');
  }

  let query = client
    .from('analytics_requests')
    .select('llm_model, tokens_used')
    .not('llm_model', 'is', null)
    .not('tokens_used', 'is', null);

  if (startDate) {
    query = query.gte('timestamp', startDate);
  }
  if (endDate) {
    query = query.lte('timestamp', endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch cost summary: ${error.message}`);
  }

  // Aggregate by model
  const modelStats: { [key: string]: number } = {};
  
  for (const record of data || []) {
    const model = record.llm_model;
    const tokens = record.tokens_used || 0;
    
    if (!modelStats[model]) {
      modelStats[model] = 0;
    }
    modelStats[model] += tokens;
  }

  // Calculate costs (rough estimate - assumes 75% input, 25% output split)
  return Object.entries(modelStats).map(([model, totalTokens]) => {
    const costs = MODEL_COSTS[model] || { input: 0, output: 0 };
    const estimatedInputTokens = totalTokens * 0.75;
    const estimatedOutputTokens = totalTokens * 0.25;
    const estimatedCost = 
      (estimatedInputTokens / 1_000_000) * costs.input +
      (estimatedOutputTokens / 1_000_000) * costs.output;

    return {
      model,
      total_tokens: totalTokens,
      estimated_cost: estimatedCost,
    };
  });
}

/**
 * Get performance metrics
 */
export async function getPerformanceMetrics(
  startDate?: string,
  endDate?: string
): Promise<{
  avg_latency_ms: number;
  p95_latency_ms: number;
  cache_hit_rate: number;
  success_rate: number;
  total_requests: number;
}> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase not configured');
  }

  let query = client
    .from('analytics_requests')
    .select('latency_ms, cache_hit, success');

  if (startDate) {
    query = query.gte('timestamp', startDate);
  }
  if (endDate) {
    query = query.lte('timestamp', endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch performance metrics: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return {
      avg_latency_ms: 0,
      p95_latency_ms: 0,
      cache_hit_rate: 0,
      success_rate: 0,
      total_requests: 0,
    };
  }

  // Calculate metrics
  const latencies = data.map(r => r.latency_ms || 0).sort((a, b) => a - b);
  const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  const p95Index = Math.floor(latencies.length * 0.95);
  const p95Latency = latencies[p95Index] || 0;

  const cacheHits = data.filter(r => r.cache_hit === true).length;
  const cacheHitRate = cacheHits / data.length;

  const successes = data.filter(r => r.success === true).length;
  const successRate = successes / data.length;

  return {
    avg_latency_ms: Math.round(avgLatency),
    p95_latency_ms: p95Latency,
    cache_hit_rate: Math.round(cacheHitRate * 100) / 100,
    success_rate: Math.round(successRate * 100) / 100,
    total_requests: data.length,
  };
}
