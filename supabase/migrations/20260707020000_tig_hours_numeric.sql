-- tig_hours_completed stored as INT loses 0.5h sessions. Widen to NUMERIC(6,2).
-- Also apply to tig_attendance.hours_worked for consistency.
ALTER TABLE cases
  ALTER COLUMN tig_hours_completed TYPE NUMERIC(6,2);
