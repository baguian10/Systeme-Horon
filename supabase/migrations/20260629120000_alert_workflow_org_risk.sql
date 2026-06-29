-- Alert workflow (#3) + organisation/jurisdictions tree (#5) + risk level (#12)
-- 2026-06-29

-- ── #3 Alert lifecycle workflow ─────────────────────────────────────────────
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS status              TEXT NOT NULL DEFAULT 'NEW',  -- NEW|ACKNOWLEDGED|IN_PROGRESS|RESOLVED|FALSE_ALARM
  ADD COLUMN IF NOT EXISTS assigned_to         UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS acknowledged_by     UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS acknowledged_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_category TEXT,                          -- JUSTIFIED|FALSE_ALARM|TECHNICAL|INTERVENTION
  ADD COLUMN IF NOT EXISTS resolution_reason   TEXT;

-- Backfill existing resolved alerts into the new status model.
UPDATE alerts SET status = 'RESOLVED' WHERE is_resolved = true AND status = 'NEW';

-- ── #5 Organisation / jurisdictions hierarchy ───────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'COURT',   -- COURT|JURISDICTION|UNIT
  parent_id  UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY departments_read ON departments FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── #12 Risk level (drives monitoring intensity) ────────────────────────────
ALTER TABLE cases ADD COLUMN IF NOT EXISTS risk_level TEXT NOT NULL DEFAULT 'MEDIUM'; -- LOW|MEDIUM|HIGH
