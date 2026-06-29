-- Voice communication config (TR40 / ThinkRace IW) — 2026-06-29
-- BP12 SOS numbers, BP14 white list (name|phone), BPPH phone-call switch.
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS sos_numbers    TEXT[],   -- up to 3 numbers the bracelet dials on SOS
  ADD COLUMN IF NOT EXISTS call_whitelist JSONB,    -- [{name, phone}] allowed to call/command
  ADD COLUMN IF NOT EXISTS call_enabled   BOOLEAN NOT NULL DEFAULT true;
