-- Analytics Events Table for UI interactions
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  user_agent TEXT,
  ip TEXT,
  file_name TEXT,
  file_type VARCHAR(32)
);

CREATE INDEX IF NOT EXISTS idx_events_type_time ON analytics_events (event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON analytics_events (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_file ON analytics_events (file_name, file_type);

-- Optional view for recent UI events
CREATE OR REPLACE VIEW analytics_recent_ui_events AS
SELECT id, event_type, timestamp, metadata, file_name, file_type
FROM analytics_events
ORDER BY timestamp DESC
LIMIT 1000;
