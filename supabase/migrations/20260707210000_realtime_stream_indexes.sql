-- Cursor queries for the /api/realtime/stream SSE feed (every 2.5 s):
--   positions      WHERE recorded_at  > $cursor ORDER BY recorded_at
--   alerts         WHERE triggered_at > $cursor ORDER BY triggered_at
--   device_events  WHERE created_at   > $cursor ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_positions_recorded_at    ON positions(recorded_at);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at      ON alerts(triggered_at);
CREATE INDEX IF NOT EXISTS idx_device_events_created_at ON device_events(created_at);
