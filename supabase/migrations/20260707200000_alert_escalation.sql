-- Escalation engine markers: one-shot flags so each alert escalates once per level.
-- L1: unacknowledged past settings.escalate_minutes → notify the case judge.
-- L2: severity >= 4 unresolved past 2h → notify all SUPER_ADMINs.
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS escalated_at timestamptz;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS escalated_l2_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_alerts_escalation
  ON alerts(triggered_at)
  WHERE is_resolved = false;
