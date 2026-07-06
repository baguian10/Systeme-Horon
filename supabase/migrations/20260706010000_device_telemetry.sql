-- Device telemetry history: a compact time-series of battery and cellular
-- signal, written on each Traxbean poll. Powers the battery/signal trend
-- sparklines on the device detail page. Kept small (two smallints + a time);
-- prune with the data-retention cron alongside positions.

CREATE TABLE IF NOT EXISTS device_telemetry (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  battery_pct SMALLINT CHECK (battery_pct BETWEEN 0 AND 100),
  signal_dbm  INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_telemetry_dev_time
  ON device_telemetry (device_id, recorded_at DESC);

ALTER TABLE device_telemetry ENABLE ROW LEVEL SECURITY;
-- Read via the service role (admin client) only; no public policy is required.
