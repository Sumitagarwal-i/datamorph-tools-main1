-- ================================================================
-- Detective D Analytics & Telemetry Schema
-- ================================================================
-- This migration creates tables and indexes for tracking:
-- - Request metrics (latency, errors, success rate)
-- - Cost tracking (tokens, models)
-- - Performance monitoring
-- - Usage analytics
-- ================================================================

-- Drop existing table if exists (CAUTION: data loss!)
-- Comment this out if you want to preserve existing data
-- DROP TABLE IF EXISTS analytics_requests;

-- ================================================================
-- Main Analytics Table
-- ================================================================
CREATE TABLE IF NOT EXISTS analytics_requests (
  -- Primary identification
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Request metadata
  file_type VARCHAR(20) NOT NULL,
  content_length INTEGER NOT NULL,
  was_truncated BOOLEAN NOT NULL DEFAULT FALSE,
  max_errors_requested INTEGER,
  
  -- LLM information
  llm_provider VARCHAR(50),
  llm_model VARCHAR(100),
  tokens_used INTEGER,
  
  -- Performance metrics
  latency_ms INTEGER NOT NULL,
  cache_hit BOOLEAN DEFAULT FALSE,
  
  -- Results
  total_errors INTEGER NOT NULL DEFAULT 0,
  total_warnings INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_type VARCHAR(50),
  
  -- Quality metrics
  sanity_checks_passed INTEGER,
  sanity_checks_failed INTEGER,
  
  -- RAG usage
  rag_snippets_used INTEGER,
  
  -- Optional metadata (anonymized)
  user_agent TEXT,
  country VARCHAR(10),
  
  -- Indexes for common queries
  CONSTRAINT valid_file_type CHECK (file_type IN ('json', 'csv', 'xml', 'yaml', 'auto', 'unknown')),
  CONSTRAINT valid_latency CHECK (latency_ms >= 0),
  CONSTRAINT valid_tokens CHECK (tokens_used IS NULL OR tokens_used >= 0)
);

-- ================================================================
-- Indexes for Performance
-- ================================================================

-- Time-based queries (most common)
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp 
  ON analytics_requests (timestamp DESC);

-- Date range queries
CREATE INDEX IF NOT EXISTS idx_analytics_date_range 
  ON analytics_requests (timestamp, success, file_type);

-- Model cost tracking
CREATE INDEX IF NOT EXISTS idx_analytics_model_tokens 
  ON analytics_requests (llm_model, tokens_used) 
  WHERE llm_model IS NOT NULL;

-- Performance analysis
CREATE INDEX IF NOT EXISTS idx_analytics_performance 
  ON analytics_requests (file_type, latency_ms, cache_hit);

-- Error tracking
CREATE INDEX IF NOT EXISTS idx_analytics_errors 
  ON analytics_requests (success, error_type) 
  WHERE success = FALSE;

-- Cache effectiveness
CREATE INDEX IF NOT EXISTS idx_analytics_cache 
  ON analytics_requests (cache_hit, timestamp) 
  WHERE cache_hit IS NOT NULL;

-- ================================================================
-- Useful Views for Analytics
-- ================================================================

-- Daily summary view
CREATE OR REPLACE VIEW analytics_daily_summary AS
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE success = TRUE) as successful_requests,
  COUNT(*) FILTER (WHERE success = FALSE) as failed_requests,
  COUNT(*) FILTER (WHERE cache_hit = TRUE) as cache_hits,
  AVG(latency_ms) as avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
  SUM(tokens_used) as total_tokens,
  SUM(total_errors) as total_errors_found,
  SUM(total_warnings) as total_warnings_found
FROM analytics_requests
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Model cost summary view
CREATE OR REPLACE VIEW analytics_model_costs AS
SELECT 
  llm_model,
  COUNT(*) as request_count,
  SUM(tokens_used) as total_tokens,
  AVG(tokens_used) as avg_tokens_per_request,
  AVG(latency_ms) as avg_latency_ms,
  COUNT(*) FILTER (WHERE success = TRUE) as successful_requests,
  ROUND(
    CAST(COUNT(*) FILTER (WHERE success = TRUE) AS DECIMAL) / 
    NULLIF(COUNT(*), 0) * 100, 
    2
  ) as success_rate_percent
FROM analytics_requests
WHERE llm_model IS NOT NULL
GROUP BY llm_model
ORDER BY total_tokens DESC;

-- File type performance view
CREATE OR REPLACE VIEW analytics_by_file_type AS
SELECT 
  file_type,
  COUNT(*) as request_count,
  AVG(latency_ms) as avg_latency_ms,
  AVG(content_length) as avg_content_length,
  COUNT(*) FILTER (WHERE was_truncated = TRUE) as truncated_count,
  COUNT(*) FILTER (WHERE success = TRUE) as successful_count,
  AVG(total_errors) as avg_errors_found,
  COUNT(*) FILTER (WHERE cache_hit = TRUE) as cache_hits
FROM analytics_requests
GROUP BY file_type
ORDER BY request_count DESC;

-- Hourly traffic pattern view
CREATE OR REPLACE VIEW analytics_hourly_traffic AS
SELECT 
  EXTRACT(HOUR FROM timestamp) as hour_of_day,
  COUNT(*) as request_count,
  AVG(latency_ms) as avg_latency_ms,
  COUNT(*) FILTER (WHERE success = TRUE) as successful_requests
FROM analytics_requests
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY EXTRACT(HOUR FROM timestamp)
ORDER BY hour_of_day;

-- ================================================================
-- Helper Functions
-- ================================================================

-- Function to clean up old analytics data (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_analytics(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM analytics_requests
  WHERE timestamp < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- Row Level Security (RLS) - Optional
-- ================================================================
-- Uncomment if you want to enable RLS for multi-tenant scenarios

-- ALTER TABLE analytics_requests ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
-- CREATE POLICY "Service role has full access" ON analytics_requests
--   FOR ALL
--   USING (auth.role() = 'service_role')
--   WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated admin users read access
-- CREATE POLICY "Authenticated users can read analytics" ON analytics_requests
--   FOR SELECT
--   USING (auth.role() = 'authenticated');

-- ================================================================
-- Grants
-- ================================================================

-- Grant access to service role
GRANT ALL ON analytics_requests TO service_role;
GRANT ALL ON analytics_requests_id_seq TO service_role;

-- Grant read access to authenticated users (for dashboards)
GRANT SELECT ON analytics_requests TO authenticated;
GRANT SELECT ON analytics_daily_summary TO authenticated;
GRANT SELECT ON analytics_model_costs TO authenticated;
GRANT SELECT ON analytics_by_file_type TO authenticated;
GRANT SELECT ON analytics_hourly_traffic TO authenticated;

-- ================================================================
-- Sample Queries for Testing
-- ================================================================

-- Test query 1: Recent requests
-- SELECT * FROM analytics_requests ORDER BY timestamp DESC LIMIT 10;

-- Test query 2: Cost by model (last 7 days)
-- SELECT * FROM analytics_model_costs;

-- Test query 3: Daily summary (last 30 days)
-- SELECT * FROM analytics_daily_summary LIMIT 30;

-- Test query 4: Performance by file type
-- SELECT * FROM analytics_by_file_type;

-- Test query 5: Cache hit rate
-- SELECT 
--   COUNT(*) FILTER (WHERE cache_hit = TRUE) as cache_hits,
--   COUNT(*) as total_requests,
--   ROUND(
--     CAST(COUNT(*) FILTER (WHERE cache_hit = TRUE) AS DECIMAL) / 
--     NULLIF(COUNT(*), 0) * 100, 
--     2
--   ) as cache_hit_rate_percent
-- FROM analytics_requests
-- WHERE timestamp >= NOW() - INTERVAL '24 hours';

-- ================================================================
-- Migration Complete!
-- ================================================================
-- Next steps:
-- 1. Run this migration in your Supabase SQL editor
-- 2. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
-- 3. Set ADMIN_API_KEY for analytics endpoint access
-- 4. Deploy and start collecting metrics!
-- ================================================================
