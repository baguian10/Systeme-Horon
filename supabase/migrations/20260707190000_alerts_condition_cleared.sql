-- Decouple alert deduplication from manual resolution.
-- condition_cleared_at marks the moment the violating condition ended
-- (subject back inside the zone / beacon back in range). The alert stays
-- OPEN — closing it remains a manual operator act — but a new violation
-- episode is allowed to raise a fresh alert.
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS condition_cleared_at timestamptz;

-- Dedup lookup: open alerts of a type on a case whose episode is still running.
CREATE INDEX IF NOT EXISTS idx_alerts_open_episode
  ON alerts(case_id, alert_type)
  WHERE is_resolved = false AND condition_cleared_at IS NULL;
