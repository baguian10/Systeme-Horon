-- TIG full system: create tig_sites table (was never migrated — existed only in
-- local mock), link cases to TIG sites, track ordered/completed hours,
-- and record individual attendance sessions.

-- ── tig_sites ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE tig_site_category AS ENUM (
    'MAIRIE','HOPITAL','ECOLE','ONG','ESPACE_VERT','AUTRE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tig_sites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  category         tig_site_category NOT NULL,
  address          TEXT NOT NULL,
  arrondissement   TEXT NOT NULL,
  contact_name     TEXT NOT NULL,
  contact_phone    TEXT NOT NULL DEFAULT '',
  capacity         INT NOT NULL DEFAULT 1,
  current_count    INT NOT NULL DEFAULT 0,
  hours            TEXT NOT NULL DEFAULT 'Lun–Ven 08h00–17h00',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tig_sites_active_idx ON tig_sites(is_active);

-- ── cases ↔ tig_sites link ──────────────────────────────────────────────────
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS tig_site_id        UUID REFERENCES tig_sites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tig_hours_ordered  INT,
  ADD COLUMN IF NOT EXISTS tig_hours_completed INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS cases_tig_site_idx ON cases(tig_site_id)
  WHERE tig_site_id IS NOT NULL;

-- ── tig_attendance ──────────────────────────────────────────────────────────
-- One row per work session (demi-journée / journée) signed by site supervisor.
CREATE TABLE IF NOT EXISTS tig_attendance (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id          UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  tig_site_id      UUID NOT NULL REFERENCES tig_sites(id) ON DELETE RESTRICT,
  session_date     DATE NOT NULL,
  hours_worked     NUMERIC(4,2) NOT NULL CHECK (hours_worked > 0 AND hours_worked <= 24),
  signed_by_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  supervisor_notes TEXT,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tig_attendance_case_idx ON tig_attendance(case_id);
CREATE INDEX IF NOT EXISTS tig_attendance_site_idx ON tig_attendance(tig_site_id);
CREATE INDEX IF NOT EXISTS tig_attendance_date_idx ON tig_attendance(session_date DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Writes go through the service-role client (app-level authz).
-- Reads: JUDGE and OPERATIONAL can read attendance for cases they own/are assigned.
ALTER TABLE tig_attendance ENABLE ROW LEVEL SECURITY;

-- Service-role bypasses RLS — used by server actions.
-- JUDGE: read attendance records for cases they supervise.
DO $$ BEGIN
  CREATE POLICY tig_attendance_judge_read ON tig_attendance
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM cases c
        WHERE c.id = tig_attendance.case_id
          AND c.judge_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OPERATIONAL: read records for cases assigned to them.
DO $$ BEGIN
  CREATE POLICY tig_attendance_operational_read ON tig_attendance
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM case_assignments ca
        WHERE ca.case_id = tig_attendance.case_id
          AND ca.operational_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
