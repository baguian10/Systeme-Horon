-- Institutional account lifecycle:
--   expires_at          — end of mission / secondment; session denied past it
--   deactivation_reason — mandatory motive kept with the account (audit trail)
ALTER TABLE users ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason text;
