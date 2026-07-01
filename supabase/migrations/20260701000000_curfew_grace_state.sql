-- Grace-clock state for the case-level structured curfew (curfew_days/start/end).
-- Mirrors geofences.out_since but for the whole-case curfew schedule.
ALTER TABLE cases ADD COLUMN IF NOT EXISTS curfew_out_since TIMESTAMPTZ;
