-- Curfew enforcement + realtime push (Itinéraire/Couvre-feu features, 2026-06-29)

-- 1. New alert type for curfew (assignation à résidence) breaches.
--    ADD VALUE must run outside an explicit transaction; Supabase runs each
--    statement separately so IF NOT EXISTS keeps this idempotent.
ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'CURFEW_VIOLATION';

-- 2. Grace period + out-of-zone clock for time-windowed inclusion geofences.
ALTER TABLE geofences
  ADD COLUMN IF NOT EXISTS grace_minutes INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS out_since     TIMESTAMPTZ;

-- 3. Enable Supabase Realtime push on positions + alerts (live map / toasts).
--    Idempotent — ignore if the table is already in the publication.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE positions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
