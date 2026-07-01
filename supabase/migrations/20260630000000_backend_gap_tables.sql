-- ============================================================
-- Système Horon / SIGEP — Backend-gap tables
-- Builds the previously mock-only features server-side:
--   obligations (agenda), revocations, maintenance_tickets,
--   message_threads + messages, journal_entries.
-- Writes go through the service-role client (app-level authz), so RLS
-- here only scopes READS for JUDGE / OPERATIONAL; SUPER_ADMIN/ADMIN read
-- via the admin client. Apply with: supabase db push
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enumerations (idempotent) ────────────────────────────────
DO $$ BEGIN CREATE TYPE obligation_type AS ENUM ('TIG_SHIFT','CURFEW_CHECK','COURT_DATE','MONITORING_VISIT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE revocation_status AS ENUM ('PENDING','UNDER_REVIEW','APPROVED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE journal_entry_type AS ENUM ('POSITIVE','NEUTRAL','NEGATIVE','INCIDENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE maintenance_type AS ENUM ('BATTERY','FIRMWARE','HARDWARE','CALIBRATION','REPLACEMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE maintenance_status AS ENUM ('PENDING','IN_PROGRESS','DONE','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tables ───────────────────────────────────────────────────

-- Agenda of legal obligations attached to a case.
CREATE TABLE IF NOT EXISTS obligations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  obligation_type obligation_type NOT NULL,
  title           TEXT NOT NULL,
  scheduled_date  DATE NOT NULL,
  start_time      TIME,
  end_time        TIME,
  location        TEXT,
  is_confirmed    BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS obligations_case_idx ON obligations(case_id);
CREATE INDEX IF NOT EXISTS obligations_date_idx ON obligations(scheduled_date);

-- Revocation procedures (TIG → imprisonment conversion requests).
CREATE TABLE IF NOT EXISTS revocations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  requested_by_id UUID REFERENCES users(id),
  reason          TEXT NOT NULL,
  violation_count INT NOT NULL DEFAULT 0,
  status          revocation_status NOT NULL DEFAULT 'PENDING',
  judge_decision  TEXT,
  decided_by      UUID REFERENCES users(id),
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS revocations_case_idx ON revocations(case_id);
CREATE INDEX IF NOT EXISTS revocations_status_idx ON revocations(status);

-- Hardware maintenance tickets for bracelets.
CREATE TABLE IF NOT EXISTS maintenance_tickets (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id        UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  maintenance_type maintenance_type NOT NULL,
  status           maintenance_status NOT NULL DEFAULT 'PENDING',
  priority         SMALLINT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  description      TEXT NOT NULL,
  assigned_to      UUID REFERENCES users(id),
  scheduled_at     TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS maintenance_device_idx ON maintenance_tickets(device_id);
CREATE INDEX IF NOT EXISTS maintenance_status_idx ON maintenance_tickets(status);

-- Secure internal messaging: threads + messages.
CREATE TABLE IF NOT EXISTS message_threads (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id              UUID REFERENCES cases(id) ON DELETE SET NULL,
  subject              TEXT NOT NULL,
  participant_ids      UUID[] NOT NULL DEFAULT '{}',
  last_message_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_preview TEXT,
  created_by           UUID REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS threads_participants_idx ON message_threads USING GIN (participant_ids);
CREATE INDEX IF NOT EXISTS threads_last_msg_idx ON message_threads(last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id  UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES users(id),
  content    TEXT NOT NULL,
  is_read_by UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_thread_idx ON messages(thread_id, created_at);

-- Case journal: field observations tied to a case.
CREATE TABLE IF NOT EXISTS journal_entries (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id    UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id),
  entry_type journal_entry_type NOT NULL DEFAULT 'NEUTRAL',
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS journal_case_idx ON journal_entries(case_id, created_at DESC);

-- ── Row Level Security ───────────────────────────────────────
-- current_user_role() and is_assigned_to_case() are defined by the
-- initial schema migration. Reads for SUPER_ADMIN/ADMIN go through the
-- service-role client and bypass RLS; the policies below scope the
-- RLS-bound JUDGE and OPERATIONAL roles. All writes use the service role.

ALTER TABLE obligations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE revocations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads     ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries     ENABLE ROW LEVEL SECURITY;

-- Helper: id of the current authenticated app user.
CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM users WHERE auth_id = auth.uid();
$$;

-- obligations: judge owns the case, operational is assigned to it.
DO $$ BEGIN
  CREATE POLICY obligations_judge ON obligations FOR SELECT USING (
    current_user_role() = 'JUDGE' AND EXISTS (
      SELECT 1 FROM cases c WHERE c.id = obligations.case_id AND c.judge_id = current_app_user_id()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY obligations_operational ON obligations FOR SELECT USING (
    current_user_role() = 'OPERATIONAL' AND is_assigned_to_case(case_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- revocations: same case scoping.
DO $$ BEGIN
  CREATE POLICY revocations_judge ON revocations FOR SELECT USING (
    current_user_role() = 'JUDGE' AND EXISTS (
      SELECT 1 FROM cases c WHERE c.id = revocations.case_id AND c.judge_id = current_app_user_id()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY revocations_operational ON revocations FOR SELECT USING (
    current_user_role() = 'OPERATIONAL' AND is_assigned_to_case(case_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- journal_entries: same case scoping.
DO $$ BEGIN
  CREATE POLICY journal_judge ON journal_entries FOR SELECT USING (
    current_user_role() = 'JUDGE' AND EXISTS (
      SELECT 1 FROM cases c WHERE c.id = journal_entries.case_id AND c.judge_id = current_app_user_id()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY journal_operational ON journal_entries FOR SELECT USING (
    current_user_role() = 'OPERATIONAL' AND is_assigned_to_case(case_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- message_threads / messages: participant-scoped (any role that is a participant).
DO $$ BEGIN
  CREATE POLICY threads_participant ON message_threads FOR SELECT USING (
    current_app_user_id() = ANY (participant_ids));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY messages_participant ON messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM message_threads t
            WHERE t.id = messages.thread_id AND current_app_user_id() = ANY (t.participant_ids)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- maintenance_tickets: no JUDGE/OPERATIONAL read policy — this view is
-- SUPER_ADMIN-only and served through the admin client. RLS stays enabled
-- so no other role can read it directly.
