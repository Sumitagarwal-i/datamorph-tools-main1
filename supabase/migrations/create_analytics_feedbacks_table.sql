-- Feedback events table for Detective D UI feedback popup
CREATE TABLE IF NOT EXISTS analytics_feedbacks (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL DEFAULT 'analysis_feedback',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  file_name TEXT,
  file_type VARCHAR(32),
  main_answer VARCHAR(32), -- yes | somewhat | no
  follow_up TEXT,
  free_text TEXT,
  use_case VARCHAR(64),
  user_agent TEXT,
  ip TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_time ON analytics_feedbacks (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_feedbacks_file ON analytics_feedbacks (file_name, file_type);

-- Sample query to inspect feedback
-- SELECT * FROM analytics_feedbacks ORDER BY timestamp DESC LIMIT 50;
