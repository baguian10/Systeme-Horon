-- Tracks the last expiry-reminder threshold (days) already sent for a case,
-- so the daily reminder cron notifies once per crossed threshold (7/3/1) rather
-- than every day. Reset to NULL when the measure is extended/reactivated.
ALTER TABLE cases ADD COLUMN IF NOT EXISTS expiry_reminder_stage SMALLINT;
