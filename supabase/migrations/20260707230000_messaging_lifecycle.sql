-- Institutional messaging lifecycle: a thread can be CLOSED (read-only archive
-- with legal timestamp + author). Reopening is SUPER_ADMIN only.
ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE message_threads ADD COLUMN IF NOT EXISTS closed_by uuid;

-- Poll feed cursor: fetch a thread's messages newer than a timestamp.
CREATE INDEX IF NOT EXISTS idx_messages_thread_created
  ON messages(thread_id, created_at);
