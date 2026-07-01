-- Cache the Traxbean session token in the DB so all serverless invocations
-- share one login (module memory doesn't survive between invocations, so a
-- per-poll login would hammer /admin/login and get the account locked out).
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS traxbean_token    TEXT,
  ADD COLUMN IF NOT EXISTS traxbean_token_at TIMESTAMPTZ;
