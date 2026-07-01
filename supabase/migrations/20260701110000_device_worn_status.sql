-- Wearing status of the bracelet (anti-removal). Sourced from the platform's
-- target `wear` field (-1 unknown / 0 removed / 1 worn) each poll.
--   worn = true  → on the body
--   worn = false → removed
--   worn = null  → detection not active / unknown
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS worn            BOOLEAN,
  ADD COLUMN IF NOT EXISTS worn_checked_at TIMESTAMPTZ;
