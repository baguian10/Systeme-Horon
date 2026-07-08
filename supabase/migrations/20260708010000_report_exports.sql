-- Real export log for official reports (replaces a hardcoded fake list).
-- One row per report generation — who, what, when. Auditable trail for
-- documents produced to courts and the ministry.
CREATE TABLE IF NOT EXISTS report_exports (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type       text NOT NULL,
  title             text NOT NULL,
  generated_by      uuid,
  generated_by_name text,
  generated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_exports_generated_at ON report_exports(generated_at DESC);

ALTER TABLE report_exports ENABLE ROW LEVEL SECURITY;
-- Service-role access only (no policies) — written/read through the app.
