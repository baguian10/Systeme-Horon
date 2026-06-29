-- ADMIN (delegated admin) read policies (additive) — same rationale as the
-- SUPER_ADMIN ones: browser Realtime is RLS-filtered, so without a SELECT policy
-- delegated admins get no live positions/alerts on the surveillance view.
-- 2026-06-29
DO $$ BEGIN
  CREATE POLICY positions_admin ON positions FOR SELECT
    USING (current_user_role() = 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY alerts_admin ON alerts FOR SELECT
    USING (current_user_role() = 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
