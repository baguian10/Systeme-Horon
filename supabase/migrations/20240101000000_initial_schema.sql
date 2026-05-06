-- ============================================================
-- Système Horon / SIGEP — Initial Schema Migration
-- Apply with: supabase db push
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enumerations ─────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN',   -- Level 0: Full system access
  'STRATEGIC',     -- Level 1: Aggregate statistics, no PII
  'JUDGE',         -- Level 2: Creates cases and geofences
  'OPERATIONAL'    -- Level 3: Assigned individuals only (read-only)
);

CREATE TYPE case_status AS ENUM (
  'PENDING',       -- Ordonnance reçue, bracelet non posé
  'ACTIVE',        -- Bracelet en service
  'SUSPENDED',     -- Suspendu temporairement
  'TERMINATED',    -- Fin de mesure
  'VIOLATION'      -- Violation détectée, dossier actif
);

CREATE TYPE alert_type AS ENUM (
  'GEOFENCE_EXIT',
  'TAMPER_DETECTED',
  'HEALTH_CRITICAL',
  'BATTERY_LOW',
  'SIGNAL_LOST',
  'PANIC_BUTTON'
);

-- ── Core Tables ───────────────────────────────────────────────

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id       UUID UNIQUE NOT NULL,
  role          user_role NOT NULL,
  full_name     TEXT NOT NULL,
  badge_number  TEXT UNIQUE,
  jurisdiction  TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE individuals (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  national_id   TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  address       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cases (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  individual_id     UUID NOT NULL REFERENCES individuals(id),
  judge_id          UUID NOT NULL REFERENCES users(id),
  case_number       TEXT UNIQUE NOT NULL,
  status            case_status NOT NULL DEFAULT 'PENDING',
  court_order_date  DATE NOT NULL,
  start_date        TIMESTAMPTZ,
  end_date          TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE devices (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID UNIQUE REFERENCES cases(id),
  imei          TEXT UNIQUE NOT NULL,
  model         TEXT NOT NULL DEFAULT 'Dispositif Électronique Sécurisé',
  firmware_ver  TEXT,
  battery_pct   SMALLINT CHECK (battery_pct BETWEEN 0 AND 100),
  is_online     BOOLEAN NOT NULL DEFAULT false,
  last_seen_at  TIMESTAMPTZ,
  assigned_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE geofences (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NOT NULL REFERENCES cases(id),
  name          TEXT NOT NULL,
  is_exclusion  BOOLEAN NOT NULL DEFAULT false,
  area          JSONB NOT NULL,
  active_start  TIME,
  active_end    TIME,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE positions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id     UUID NOT NULL REFERENCES devices(id),
  case_id       UUID NOT NULL REFERENCES cases(id),
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,
  accuracy_m    REAL,
  speed_kmh     REAL,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_positions_case_time ON positions (case_id, recorded_at DESC);

CREATE TABLE alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES cases(id),
  device_id       UUID NOT NULL REFERENCES devices(id),
  alert_type      alert_type NOT NULL,
  severity        SMALLINT NOT NULL DEFAULT 2 CHECK (severity BETWEEN 1 AND 5),
  description     TEXT,
  position_lat    DOUBLE PRECISION,
  position_lon    DOUBLE PRECISION,
  is_resolved     BOOLEAN NOT NULL DEFAULT false,
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE case_assignments (
  case_id         UUID NOT NULL REFERENCES cases(id),
  operational_id  UUID NOT NULL REFERENCES users(id),
  assigned_by     UUID NOT NULL REFERENCES users(id),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (case_id, operational_id)
);

CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  table_name  TEXT,
  record_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE individuals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases            ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofences        ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log        ENABLE ROW LEVEL SECURITY;

-- Helper: get the calling user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT role FROM users WHERE auth_id = auth.uid();
$$;

-- Helper: check if the calling user is assigned to a case (Level 3 isolation)
CREATE OR REPLACE FUNCTION is_assigned_to_case(p_case_id UUID)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM case_assignments ca
    JOIN users u ON u.id = ca.operational_id
    WHERE ca.case_id = p_case_id AND u.auth_id = auth.uid()
  );
$$;

-- ── RLS Policies ─────────────────────────────────────────────

CREATE POLICY "cases_judge_own" ON cases FOR ALL
  USING (
    current_user_role() = 'JUDGE'
    AND judge_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

CREATE POLICY "cases_operational_assigned" ON cases FOR SELECT
  USING (current_user_role() = 'OPERATIONAL' AND is_assigned_to_case(id));

CREATE POLICY "individuals_judge_own_cases" ON individuals FOR SELECT
  USING (
    current_user_role() IN ('JUDGE', 'OPERATIONAL') AND EXISTS (
      SELECT 1 FROM cases c WHERE c.individual_id = individuals.id AND (
        (current_user_role() = 'JUDGE' AND c.judge_id = (SELECT id FROM users WHERE auth_id = auth.uid()))
        OR (current_user_role() = 'OPERATIONAL' AND is_assigned_to_case(c.id))
      )
    )
  );

CREATE POLICY "positions_judge" ON positions FOR SELECT
  USING (
    current_user_role() = 'JUDGE' AND EXISTS (
      SELECT 1 FROM cases c WHERE c.id = positions.case_id
        AND c.judge_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "positions_operational_assigned" ON positions FOR SELECT
  USING (current_user_role() = 'OPERATIONAL' AND is_assigned_to_case(case_id));

CREATE POLICY "geofences_judge" ON geofences FOR ALL
  USING (
    current_user_role() = 'JUDGE' AND EXISTS (
      SELECT 1 FROM cases c WHERE c.id = geofences.case_id
        AND c.judge_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "geofences_operational_read" ON geofences FOR SELECT
  USING (current_user_role() = 'OPERATIONAL' AND is_assigned_to_case(case_id));

CREATE POLICY "alerts_judge" ON alerts FOR SELECT
  USING (
    current_user_role() = 'JUDGE' AND EXISTS (
      SELECT 1 FROM cases c WHERE c.id = alerts.case_id
        AND c.judge_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "alerts_operational_assigned" ON alerts FOR SELECT
  USING (current_user_role() = 'OPERATIONAL' AND is_assigned_to_case(case_id));

CREATE POLICY "assignments_judge_manage" ON case_assignments FOR ALL
  USING (
    current_user_role() = 'JUDGE' AND EXISTS (
      SELECT 1 FROM cases c WHERE c.id = case_assignments.case_id
        AND c.judge_id = (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "assignments_operational_self" ON case_assignments FOR SELECT
  USING (
    current_user_role() = 'OPERATIONAL'
    AND operational_id = (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- SUPER_ADMIN reads audit_log via service-role key (bypasses RLS)
-- All other roles are denied at the policy level
CREATE POLICY "audit_super_admin_only" ON audit_log USING (false);

-- ── Auth trigger: auto-create user row on Supabase sign-up ───
-- Run this after creating your first SUPER_ADMIN in the Supabase dashboard.
-- INSERT INTO users (auth_id, role, full_name) VALUES ('<auth.uid>', 'SUPER_ADMIN', 'Admin Name');
