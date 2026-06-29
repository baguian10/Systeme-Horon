-- #3 Hard department scoping (RLS). ADDITIVE only — these are extra SELECT
-- policies that GRANT a judge read access to cases of their jurisdiction
-- subtree. They never remove existing access. Opt-in: a policy only matches
-- when BOTH the caller and the row carry a department, so behaviour is
-- unchanged until departments are assigned. 2026-06-29

-- Caller's department.
CREATE OR REPLACE FUNCTION current_user_department() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM users WHERE auth_id = auth.uid();
$$;

-- True when p_dept is the caller's department or one of its descendants.
CREATE OR REPLACE FUNCTION dept_in_user_subtree(p_dept uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE sub AS (
    SELECT id FROM departments WHERE id = current_user_department()
    UNION ALL
    SELECT d.id FROM departments d JOIN sub ON d.parent_id = sub.id
  )
  SELECT current_user_department() IS NOT NULL
     AND p_dept IS NOT NULL
     AND p_dept IN (SELECT id FROM sub);
$$;

-- Department of a case (bypasses RLS to avoid recursion inside policies).
CREATE OR REPLACE FUNCTION case_dept(p_case uuid) RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM cases WHERE id = p_case;
$$;

DO $$ BEGIN
  CREATE POLICY cases_department ON cases FOR SELECT
    USING (current_user_role() = 'JUDGE' AND dept_in_user_subtree(department_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY positions_department ON positions FOR SELECT
    USING (current_user_role() = 'JUDGE' AND dept_in_user_subtree(case_dept(case_id)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY alerts_department ON alerts FOR SELECT
    USING (current_user_role() = 'JUDGE' AND dept_in_user_subtree(case_dept(case_id)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY geofences_department ON geofences FOR SELECT
    USING (current_user_role() = 'JUDGE' AND dept_in_user_subtree(case_dept(case_id)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY devices_department ON devices FOR SELECT
    USING (current_user_role() = 'JUDGE' AND case_id IS NOT NULL AND dept_in_user_subtree(case_dept(case_id)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY individuals_department ON individuals FOR SELECT
    USING (current_user_role() = 'JUDGE' AND EXISTS (
      SELECT 1 FROM cases c WHERE c.individual_id = individuals.id AND dept_in_user_subtree(c.department_id)
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
