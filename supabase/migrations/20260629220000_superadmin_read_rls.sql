-- SUPER_ADMIN read policies (additive) so browser Realtime delivers live
-- positions/alerts to super admins too. Until now SUPER_ADMIN had no SELECT
-- policy and relied on the service-role (server) client, which works for
-- server fetches but NOT for client-side Realtime (postgres_changes is filtered
-- by the subscriber's RLS). 2026-06-29
DO $$ BEGIN
  CREATE POLICY positions_super_admin ON positions FOR SELECT
    USING (current_user_role() = 'SUPER_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY alerts_super_admin ON alerts FOR SELECT
    USING (current_user_role() = 'SUPER_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
