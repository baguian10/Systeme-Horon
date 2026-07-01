-- Per-user notification preferences (alert type × channel push/sms/email).
-- Stored as JSONB on the user row; read/written by the notifications page.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSONB;
