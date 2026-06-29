-- SIM inventory (#11) — device labels (#10) need no schema.
-- 2026-06-29. NB: prepaid SIMs do not expire in Burkina Faso → no expiry field;
-- we track operator, in-service date and an active/suspended status only.
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS sim_carrier      TEXT,                  -- ORANGE | MOOV | TELECEL | OTHER
  ADD COLUMN IF NOT EXISTS sim_activated_at DATE,                  -- date mise en service
  ADD COLUMN IF NOT EXISTS sim_status       TEXT DEFAULT 'ACTIVE'; -- ACTIVE | SUSPENDED
