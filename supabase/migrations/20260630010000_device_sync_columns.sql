-- ============================================================
-- Système Horon / SIGEP — Device GPS-sync columns
-- The devices page (GPS real-time sync panel) reads these fields, but they
-- existed only in the TS Device type, never in the schema — so they rendered
-- "—" in production. Add them so the ingest pipeline can populate them.
-- Apply with: supabase db push  (or scripts/apply-migration.mjs)
-- ============================================================

DO $$ BEGIN CREATE TYPE network_protocol AS ENUM ('MQTT','HTTPS','TCP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE sync_status AS ENUM ('SYNCED','DELAYED','LOST'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS report_interval_s    INTEGER,
  ADD COLUMN IF NOT EXISTS network_protocol     network_protocol,
  ADD COLUMN IF NOT EXISTS sim_iccid            TEXT,
  ADD COLUMN IF NOT EXISTS signal_strength_dbm  INTEGER,
  ADD COLUMN IF NOT EXISTS gps_accuracy_m       INTEGER,
  ADD COLUMN IF NOT EXISTS tamper_detected      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS geofences_synced     INTEGER,
  ADD COLUMN IF NOT EXISTS sync_status          sync_status,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS server_endpoint      TEXT;
