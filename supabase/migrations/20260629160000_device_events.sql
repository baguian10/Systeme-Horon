-- Device event log (#2) — 2026-06-29
CREATE TABLE IF NOT EXISTS device_events (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id  UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  case_id    UUID REFERENCES cases(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,   -- ONLINE|OFFLINE|COMMAND|RESTART|TAMPER|LOW_BATTERY|SIM_CHANGE|ASSIGN
  detail     TEXT,
  actor_id   UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_device_events_dev_time ON device_events (device_id, created_at DESC);

ALTER TABLE device_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY device_events_read ON device_events FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
