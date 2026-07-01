'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import {
  canRequestCaseAction, canDecideCaseRequest, canDeleteCase, canArchiveCase,
  canSetMeasureConditions, canUpdateCaseStatus,
} from '@/lib/auth/permissions';
import { writeAudit } from '@/lib/audit/log';
import type { CaseRequestType, CaseStatus } from '@/lib/supabase/types';

const isDemoMode = () =>
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function admin() {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  return createAdminClient();
}

// ── Judge submits a request the super admin must approve ─────────────────────
export async function submitCaseRequestAction(
  _: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean } | null> {
  const session = await getSession();
  if (!session || !canRequestCaseAction(session.role)) return { error: 'Accès refusé' };

  const case_id = formData.get('case_id') as string;
  const request_type = formData.get('request_type') as CaseRequestType;
  const reason = (formData.get('reason') as string)?.trim();
  if (!case_id || !request_type || !reason) return { error: 'Motif et type requis' };

  const VALID: CaseRequestType[] = ['DELETE', 'ARCHIVE', 'REACTIVATE', 'EXTEND', 'MODIFY_CONDITIONS', 'TRANSFER_JURISDICTION'];
  if (!VALID.includes(request_type)) return { error: 'Type de requête invalide' };

  let payload: Record<string, unknown> | null = null;
  const endDate = formData.get('end_date') as string | null;
  const deptId = formData.get('department_id') as string | null;
  if (request_type === 'EXTEND' && endDate) payload = { end_date: endDate };
  if (request_type === 'TRANSFER_JURISDICTION' && deptId) payload = { department_id: deptId };

  if (isDemoMode()) return { ok: true };
  const supabase = await admin();
  if (!supabase) return { error: 'Base de données indisponible' };
  const { data, error } = await supabase.from('case_requests').insert({
    case_id, request_type, requested_by: session.id, reason, payload, status: 'PENDING',
  }).select('id').single();
  if (error) return { error: 'Erreur lors de la soumission de la requête' };
  await writeAudit({ userId: session.id, action: `REQUEST_${request_type}`, tableName: 'case_requests', recordId: data?.id, newData: { case_id, request_type } });
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
  revalidatePath('/sigep/dashboard/requetes');
  return { ok: true };
}

// ── Super admin decides a request (approve → execute, or reject) ─────────────
export async function decideCaseRequestAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canDecideCaseRequest(session.role)) return;

  const request_id = formData.get('request_id') as string;
  const decision = formData.get('decision') as 'APPROVED' | 'REJECTED';
  const note = (formData.get('decision_note') as string)?.trim() || null;
  if (!request_id || !decision) return;
  if (isDemoMode()) { revalidatePath('/sigep/dashboard/requetes'); return; }

  const supabase = await admin();
  if (!supabase) return;
  const { data: req } = await supabase.from('case_requests').select('*').eq('id', request_id).eq('status', 'PENDING').maybeSingle();
  if (!req) return;

  if (decision === 'APPROVED') {
    await executeApprovedRequest(supabase, req as ExecReq, session.id);
  }
  await supabase.from('case_requests').update({
    status: decision, decided_by: session.id, decision_note: note, decided_at: new Date().toISOString(),
  }).eq('id', request_id);
  await writeAudit({ userId: session.id, action: `REQUEST_${decision}`, tableName: 'case_requests', recordId: request_id, newData: { decision } });
  revalidatePath('/sigep/dashboard/requetes');
  revalidatePath(`/sigep/dashboard/cases/${(req as ExecReq).case_id}`);
}

type ExecReq = { id: string; case_id: string; request_type: CaseRequestType; payload: Record<string, unknown> | null };
type Sb = Awaited<ReturnType<typeof admin>>;

async function executeApprovedRequest(supabase: NonNullable<Sb>, req: ExecReq, actorId: string) {
  const caseId = req.case_id;
  switch (req.request_type) {
    case 'ARCHIVE':
      await supabase.from('cases').update({ status: 'ARCHIVED', updated_at: new Date().toISOString() }).eq('id', caseId);
      break;
    case 'REACTIVATE':
      await supabase.from('cases').update({ status: 'ACTIVE', end_date: null, updated_at: new Date().toISOString() }).eq('id', caseId);
      break;
    case 'EXTEND': {
      const end = req.payload?.end_date as string | undefined;
      if (end) await supabase.from('cases').update({ end_date: new Date(end).toISOString(), updated_at: new Date().toISOString() }).eq('id', caseId);
      break;
    }
    case 'TRANSFER_JURISDICTION': {
      const dept = req.payload?.department_id as string | undefined;
      if (dept) await supabase.from('cases').update({ department_id: dept, updated_at: new Date().toISOString() }).eq('id', caseId);
      break;
    }
    case 'MODIFY_CONDITIONS':
      if (req.payload) await supabase.from('cases').update({ ...req.payload, updated_at: new Date().toISOString() }).eq('id', caseId);
      break;
    case 'DELETE':
      await purgeCase(supabase, caseId);
      break;
  }
  await writeAudit({ userId: actorId, action: `EXEC_${req.request_type}`, tableName: 'cases', recordId: caseId });
}

// Hard purge of a case + its dependent rows. Only reachable via an approved
// DELETE request or the super admin's direct delete on an ARCHIVED case.
async function purgeCase(supabase: NonNullable<Sb>, caseId: string) {
  await supabase.from('devices').update({ case_id: null }).eq('case_id', caseId); // detach bracelet
  await supabase.from('case_assignments').delete().eq('case_id', caseId);
  await supabase.from('geofences').delete().eq('case_id', caseId);
  await supabase.from('alerts').delete().eq('case_id', caseId);
  await supabase.from('positions').delete().eq('case_id', caseId);
  // obligations, revocations, journal_entries, case_requests cascade on case delete.
  await supabase.from('cases').delete().eq('id', caseId);
}

// ── Super admin direct acts (no request needed) ──────────────────────────────
export async function archiveCaseAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canArchiveCase(session.role)) return;
  const case_id = formData.get('case_id') as string;
  if (!case_id) return;
  if (isDemoMode()) { revalidatePath(`/sigep/dashboard/cases/${case_id}`); return; }
  const supabase = await admin();
  if (!supabase) return;
  await supabase.from('cases').update({ status: 'ARCHIVED', updated_at: new Date().toISOString() }).eq('id', case_id);
  await writeAudit({ userId: session.id, action: 'ARCHIVE_CASE', tableName: 'cases', recordId: case_id });
  revalidatePath('/sigep/dashboard/cases');
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
}

export async function reactivateCaseAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canArchiveCase(session.role)) return;
  const case_id = formData.get('case_id') as string;
  if (!case_id) return;
  if (isDemoMode()) { revalidatePath(`/sigep/dashboard/cases/${case_id}`); return; }
  const supabase = await admin();
  if (!supabase) return;
  await supabase.from('cases').update({ status: 'ACTIVE', end_date: null, updated_at: new Date().toISOString() }).eq('id', case_id);
  await writeAudit({ userId: session.id, action: 'REACTIVATE_CASE', tableName: 'cases', recordId: case_id });
  revalidatePath('/sigep/dashboard/cases');
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
}

export async function deleteCaseAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canDeleteCase(session.role)) return;
  const case_id = formData.get('case_id') as string;
  if (!case_id) return;
  if (isDemoMode()) { revalidatePath('/sigep/dashboard/cases'); redirect('/sigep/dashboard/cases'); }
  const supabase = await admin();
  if (!supabase) return;
  // Safety: only a closed/archived case can be purged.
  const { data: c } = await supabase.from('cases').select('status').eq('id', case_id).maybeSingle();
  const status = (c as { status?: CaseStatus } | null)?.status;
  if (status !== 'ARCHIVED' && status !== 'TERMINATED') return; // guarded in UI; ignore otherwise
  await purgeCase(supabase, case_id);
  await writeAudit({ userId: session.id, action: 'DELETE_CASE', tableName: 'cases', recordId: case_id, oldData: { status } });
  revalidatePath('/sigep/dashboard/cases');
  redirect('/sigep/dashboard/cases');
}

// ── Structured surveillance conditions (judge / super admin, direct) ─────────
export async function setMeasureConditionsAction(
  _: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean } | null> {
  const session = await getSession();
  if (!session || !canSetMeasureConditions(session.role) || !canUpdateCaseStatus(session.role)) return { error: 'Accès refusé' };

  const case_id = formData.get('case_id') as string;
  if (!case_id) return { error: 'Dossier requis' };

  const measure_kind = (formData.get('measure_kind') as string) || null;
  const is_permanent = formData.get('is_permanent') === 'true';
  const end_date = (formData.get('end_date') as string) || null;
  const curfew_start = (formData.get('curfew_start') as string) || null;
  const curfew_end = (formData.get('curfew_end') as string) || null;
  const curfew_days = formData.getAll('curfew_days').map((d) => parseInt(d as string, 10)).filter((n) => !Number.isNaN(n));
  const obligations = (formData.get('obligations') as string)?.trim() || null;

  const update = {
    measure_kind,
    is_permanent,
    end_date: is_permanent ? null : (end_date ? new Date(end_date).toISOString() : null),
    curfew_start, curfew_end,
    curfew_days: curfew_days.length ? curfew_days : null,
    obligations,
    updated_at: new Date().toISOString(),
  };

  if (isDemoMode()) { revalidatePath(`/sigep/dashboard/cases/${case_id}`); return { ok: true }; }
  const supabase = await admin();
  if (!supabase) return { error: 'Base de données indisponible' };
  const { error } = await supabase.from('cases').update(update).eq('id', case_id);
  if (error) return { error: 'Erreur lors de l\'enregistrement des conditions' };
  await writeAudit({ userId: session.id, action: 'SET_MEASURE_CONDITIONS', tableName: 'cases', recordId: case_id, newData: { measure_kind, is_permanent } });
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
  return { ok: true };
}
