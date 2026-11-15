CREATE TABLE IF NOT EXISTS stringer_overview_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  historical_count INTEGER NOT NULL DEFAULT 0
    CHECK (typeof(historical_count) = 'integer' AND historical_count BETWEEN 0 AND 1000000)
);

CREATE INDEX IF NOT EXISTS idx_jobs_stringer ON string_jobs(stringer_id);
