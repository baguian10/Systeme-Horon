-- Institutional obligation outcome: after the scheduled date, the field agent
-- or judge records whether the obligation was honored. MISSED entries feed the
-- revocation file (also journaled on the case). EXCUSED is a judicial act.
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS outcome text
  CHECK (outcome IN ('HONORED', 'MISSED', 'EXCUSED'));
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS outcome_note text;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS outcome_by uuid;
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS outcome_at timestamptz;

-- D-1 reminder marker (cron measure-reminders) — one reminder per obligation.
ALTER TABLE obligations ADD COLUMN IF NOT EXISTS reminded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_obligations_reminder
  ON obligations(scheduled_date) WHERE reminded_at IS NULL;
