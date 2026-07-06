-- Device lifecycle status: proper decommissioning for bracelets that carry
-- judicial history and therefore cannot be hard-deleted (positions/alerts are
-- RESTRICT-protected evidence). A retired device is kept for audit but removed
-- from the active pool and never offered for assignment.
--
--   STOCK       registered, never deployed
--   ACTIVE      assigned / in service
--   MAINTENANCE temporarily out of service (fault, battery, repair)
--   RETIRED     permanently decommissioned (kept for audit)

ALTER TABLE devices ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'STOCK'
  CHECK (lifecycle_status IN ('STOCK', 'ACTIVE', 'MAINTENANCE', 'RETIRED'));
ALTER TABLE devices ADD COLUMN IF NOT EXISTS retired_at     TIMESTAMPTZ;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS retired_reason TEXT;

-- Backfill: any currently-assigned bracelet is in service.
UPDATE devices SET lifecycle_status = 'ACTIVE'
  WHERE case_id IS NOT NULL AND lifecycle_status = 'STOCK';
