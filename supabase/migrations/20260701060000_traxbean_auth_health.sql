-- Track Traxbean platform auth health so an expired TRAXBEAN_TOKEN surfaces
-- explicitly (service status + super-admin alert) instead of silently killing
-- all device tracking.
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS traxbean_auth_ok         BOOLEAN,
  ADD COLUMN IF NOT EXISTS traxbean_auth_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS traxbean_auth_alerted_at TIMESTAMPTZ;
