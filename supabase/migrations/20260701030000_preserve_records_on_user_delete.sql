-- ============================================================
-- Institutional record preservation on account deletion.
-- Almost every FK to users was ON DELETE NO ACTION, so an account that had
-- ever acted (audit, alerts, journal, decisions…) could never be deleted.
-- Institutional rule: deleting an account must NEVER erase the records it
-- produced. Historical references become NULL (record kept), and the actor's
-- identity is snapshotted where it is displayed (audit log, journal, messages),
-- so archives of a deleted account remain fully readable.
--   - cases.judge_id stays blocking → a caseload transfer is required first.
--   - case_assignments.operational_id → CASCADE (an assignment has no meaning
--     without its agent).
-- ============================================================

-- ── Identity snapshots ───────────────────────────────────────
ALTER TABLE audit_log       ADD COLUMN IF NOT EXISTS actor_name  TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE messages        ADD COLUMN IF NOT EXISTS sender_name TEXT;

UPDATE audit_log a       SET actor_name  = u.full_name FROM users u WHERE a.user_id = u.id   AND a.actor_name  IS NULL;
UPDATE journal_entries j SET author_name = u.full_name FROM users u WHERE j.author_id = u.id AND j.author_name IS NULL;
UPDATE messages m        SET sender_name = u.full_name FROM users u WHERE m.sender_id = u.id AND m.sender_name IS NULL;

-- ── Rewire FKs to ON DELETE SET NULL (record preserved) ──────
-- Helper pattern: drop the existing constraint, relax NOT NULL where needed,
-- re-add with SET NULL.

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;
ALTER TABLE audit_log ADD  CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_acknowledged_by_fkey;
ALTER TABLE alerts ADD  CONSTRAINT alerts_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_assigned_to_fkey;
ALTER TABLE alerts ADD  CONSTRAINT alerts_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_resolved_by_fkey;
ALTER TABLE alerts ADD  CONSTRAINT alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE case_requests DROP CONSTRAINT IF EXISTS case_requests_decided_by_fkey;
ALTER TABLE case_requests ADD  CONSTRAINT case_requests_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE case_requests DROP CONSTRAINT IF EXISTS case_requests_requested_by_fkey;
ALTER TABLE case_requests ADD  CONSTRAINT case_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE device_events DROP CONSTRAINT IF EXISTS device_events_actor_id_fkey;
ALTER TABLE device_events ADD  CONSTRAINT device_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE maintenance_tickets DROP CONSTRAINT IF EXISTS maintenance_tickets_assigned_to_fkey;
ALTER TABLE maintenance_tickets ADD  CONSTRAINT maintenance_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE message_threads DROP CONSTRAINT IF EXISTS message_threads_created_by_fkey;
ALTER TABLE message_threads ADD  CONSTRAINT message_threads_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE obligations DROP CONSTRAINT IF EXISTS obligations_created_by_fkey;
ALTER TABLE obligations ADD  CONSTRAINT obligations_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE revocations DROP CONSTRAINT IF EXISTS revocations_decided_by_fkey;
ALTER TABLE revocations ADD  CONSTRAINT revocations_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE revocations DROP CONSTRAINT IF EXISTS revocations_requested_by_id_fkey;
ALTER TABLE revocations ADD  CONSTRAINT revocations_requested_by_id_fkey FOREIGN KEY (requested_by_id) REFERENCES users(id) ON DELETE SET NULL;

-- NOT NULL columns → relax then SET NULL (record survives the author's deletion)
ALTER TABLE case_assignments ALTER COLUMN assigned_by DROP NOT NULL;
ALTER TABLE case_assignments DROP CONSTRAINT IF EXISTS case_assignments_assigned_by_fkey;
ALTER TABLE case_assignments ADD  CONSTRAINT case_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE geofences ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE geofences DROP CONSTRAINT IF EXISTS geofences_created_by_fkey;
ALTER TABLE geofences ADD  CONSTRAINT geofences_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE journal_entries ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_author_id_fkey;
ALTER TABLE journal_entries ADD  CONSTRAINT journal_entries_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE messages ADD  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;

-- An assignment is meaningless without its agent → remove it with the agent.
ALTER TABLE case_assignments DROP CONSTRAINT IF EXISTS case_assignments_operational_id_fkey;
ALTER TABLE case_assignments ADD  CONSTRAINT case_assignments_operational_id_fkey FOREIGN KEY (operational_id) REFERENCES users(id) ON DELETE CASCADE;
