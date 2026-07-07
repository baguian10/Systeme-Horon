-- Performance: SUM(hours_worked) per case and per-site queries do seq scans
-- without these indexes. Expected 1000+ rows within the first year of operation.
CREATE INDEX IF NOT EXISTS idx_tig_attendance_case_id     ON tig_attendance(case_id);
CREATE INDEX IF NOT EXISTS idx_tig_attendance_site_id     ON tig_attendance(tig_site_id);
CREATE INDEX IF NOT EXISTS idx_tig_attendance_case_date   ON tig_attendance(case_id, session_date);
CREATE INDEX IF NOT EXISTS idx_cases_tig_site_id          ON cases(tig_site_id) WHERE tig_site_id IS NOT NULL;
