-- Login backoff: when /admin/login fails (bad creds or a rate-limit lockout),
-- record the time and stop retrying for a cooldown window. Prevents a frequent
-- cron from hammering the login endpoint and extending the lockout.
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS traxbean_login_fail_at TIMESTAMPTZ;
