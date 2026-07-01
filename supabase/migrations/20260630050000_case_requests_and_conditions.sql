-- ============================================================
-- Institutional workflow: case requests (judge → super admin approval) and
-- structured surveillance-measure conditions on cases.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enums ────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE case_request_type AS ENUM (
  'DELETE','ARCHIVE','REACTIVATE','EXTEND','MODIFY_CONDITIONS','TRANSFER_JURISDICTION'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE case_request_status AS ENUM (
  'PENDING','APPROVED','REJECTED'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE measure_kind AS ENUM (
  'ASSIGNATION_DOMICILE','DETENTION_DOMICILE','TIG','COUVRE_FEU','INTERDICTION_ZONE','LIBERTE_SURVEILLEE'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Requests: a judge/admin asks the super admin to perform an act on a case ──
CREATE TABLE IF NOT EXISTS case_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id       UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  request_type  case_request_type NOT NULL,
  requested_by  UUID REFERENCES users(id),
  reason        TEXT NOT NULL,
  payload       JSONB,                      -- e.g. { end_date }, { department_id }, { conditions }
  status        case_request_status NOT NULL DEFAULT 'PENDING',
  decided_by    UUID REFERENCES users(id),
  decision_note TEXT,
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS case_requests_case_idx ON case_requests(case_id);
CREATE INDEX IF NOT EXISTS case_requests_status_idx ON case_requests(status);

ALTER TABLE case_requests ENABLE ROW LEVEL SECURITY;
-- Requester (judge) reads their own case requests; super admin reads all via the
-- admin client. Writes go through the service role.
DO $$ BEGIN
  CREATE POLICY case_requests_judge ON case_requests FOR SELECT USING (
    current_user_role() = 'JUDGE' AND EXISTS (
      SELECT 1 FROM cases c WHERE c.id = case_requests.case_id AND c.judge_id = current_app_user_id()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Structured surveillance-measure conditions on the case ───────────────────
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS measure_kind  measure_kind,
  ADD COLUMN IF NOT EXISTS is_permanent  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS curfew_days   SMALLINT[],   -- 0=Sun … 6=Sat
  ADD COLUMN IF NOT EXISTS curfew_start  TIME,
  ADD COLUMN IF NOT EXISTS curfew_end    TIME;
