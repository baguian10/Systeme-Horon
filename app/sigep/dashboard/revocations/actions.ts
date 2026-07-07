'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { canManageRevocations } from '@/lib/auth/permissions';
import { writeAudit } from '@/lib/audit/log';
import type { RevocationStatus } from '@/lib/supabase/types';

const isDemoMode = () =>
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function decideRevocationAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canManageRevocations(session.role)) return;

  const revocation_id = formData.get('revocation_id') as string;
  const decision      = formData.get('decision') as RevocationStatus;
  if (!revocation_id || !decision) return;

  const decisionMap: Record<RevocationStatus, string> = {
    PENDING:      '',
    UNDER_REVIEW: 'Dossier transmis pour instruction complémentaire.',
    APPROVED:     'Révocation prononcée. Conversion en peine d\'emprisonnement conformément à l\'article 28 CP. Mandat de dépôt émis.',
    REJECTED:     'Demande rejetée. Mise en garde formelle émise. Renforcement de la surveillance ordonnée.',
  };

  if (isDemoMode()) {
    const { MOCK_REVOCATIONS, MOCK_CASES } = await import('@/lib/mock/data');
    const rev = MOCK_REVOCATIONS.find((r) => r.id === revocation_id);
    if (rev) {
      rev.status = decision;
      if (decision === 'APPROVED' || decision === 'REJECTED') {
        rev.judge_decision = decisionMap[decision];
        rev.decided_at = new Date().toISOString();
      }
      // Parity with prod: approval terminates the monitoring measure.
      if (decision === 'APPROVED') {
        const c = MOCK_CASES.find((x) => x.id === rev.case_id);
        if (c) { c.status = 'TERMINATED'; c.end_date = new Date().toISOString(); }
        revalidatePath(`/sigep/dashboard/cases/${rev.case_id}`);
        revalidatePath('/sigep/dashboard/cases');
      }
    }
    await writeAudit({
      userId: session.id,
      action: `REVOCATION_${decision}`,
      tableName: 'revocations',
      recordId: revocation_id,
      newData: { decision },
    });
    revalidatePath('/sigep/dashboard/revocations');
    return;
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return;
  const decided = decision === 'APPROVED' || decision === 'REJECTED';
  const { data: rev } = await supabase
    .from('revocations')
    .update({
      status: decision,
      judge_decision: decisionMap[decision] || null,
      decided_by: decided ? session.id : null,
      decided_at: decided ? new Date().toISOString() : null,
    })
    .eq('id', revocation_id)
    .select('case_id')
    .maybeSingle();

  // Revocation granted = the electronic-monitoring measure ends (conversion to
  // custody, mandat de dépôt). Close the case so surveillance stops cleanly.
  if (decision === 'APPROVED' && rev?.case_id) {
    await supabase.from('cases')
      .update({ status: 'TERMINATED', end_date: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', rev.case_id);
    revalidatePath(`/sigep/dashboard/cases/${rev.case_id}`);
    revalidatePath('/sigep/dashboard/cases');
  }
  await writeAudit({
    userId: session.id,
    action: `REVOCATION_${decision}`,
    tableName: 'revocations',
    recordId: revocation_id,
    newData: { decision },
  });
  revalidatePath('/sigep/dashboard/revocations');
}

export async function createRevocationAction(
  _: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await getSession();
  // Requesting a revocation is an operational/judicial act — STRATEGIC is
  // aggregate-only and must not open individual proceedings.
  if (!session || session.role === 'STRATEGIC') return { error: 'Accès refusé' };

  const case_id = formData.get('case_id') as string;
  const reason  = (formData.get('reason') as string)?.trim();
  if (!case_id || !reason) return { error: 'Champs obligatoires manquants' };
  if (reason.length > 2000) return { error: 'Motif trop long (max 2000)' };

  if (isDemoMode()) {
    const { MOCK_REVOCATIONS, MOCK_CASES, MOCK_USERS } = await import('@/lib/mock/data');
    const c    = MOCK_CASES.find((x) => x.id === case_id);
    const user = MOCK_USERS.find((u) => u.id === session.id);
    if (!c) return { error: 'Dossier introuvable' };
    MOCK_REVOCATIONS.push({
      id: `rev-${Date.now()}`,
      case_id,
      case_number: c.case_number,
      individual_name: c.individual?.full_name ?? '—',
      requested_by_id: session.id,
      requested_by_name: user?.full_name ?? session.full_name,
      reason,
      violation_count: 1,
      status: 'PENDING',
      judge_decision: null,
      decided_at: null,
      created_at: new Date().toISOString(),
    });
    revalidatePath('/sigep/dashboard/revocations');
    return null;
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };
  const { data: kase } = await supabase.from('cases').select('id, status').eq('id', case_id).maybeSingle();
  if (!kase) return { error: 'Dossier introuvable' };
  // One live request per case — a second PENDING/UNDER_REVIEW would fork the procedure.
  const { count: liveCount } = await supabase
    .from('revocations')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', case_id)
    .in('status', ['PENDING', 'UNDER_REVIEW']);
  if (liveCount && liveCount > 0) return { error: 'Une demande de révocation est déjà en cours pour ce dossier' };
  const { data, error } = await supabase.from('revocations').insert({
    case_id, requested_by_id: session.id, reason, status: 'PENDING',
  }).select('id').single();
  if (error) return { error: 'Erreur lors de la création de la demande' };
  await writeAudit({ userId: session.id, action: 'CREATE_REVOCATION', tableName: 'revocations', recordId: data?.id, newData: { case_id } });
  revalidatePath('/sigep/dashboard/revocations');
  return null;
}
