'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { canManageRevocations } from '@/lib/auth/permissions';
import { writeAudit } from '@/lib/audit/log';
import type { RevocationStatus } from '@/lib/supabase/types';

const isDemoMode = () => !process.env.NEXT_PUBLIC_SUPABASE_URL;

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
    const { MOCK_REVOCATIONS } = await import('@/lib/mock/data');
    const rev = MOCK_REVOCATIONS.find((r) => r.id === revocation_id);
    if (rev) {
      rev.status = decision;
      if (decision === 'APPROVED' || decision === 'REJECTED') {
        rev.judge_decision = decisionMap[decision];
        rev.decided_at = new Date().toISOString();
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
  await supabase
    .from('revocations')
    .update({
      status: decision,
      judge_decision: decisionMap[decision] || null,
      decided_at: (decision === 'APPROVED' || decision === 'REJECTED') ? new Date().toISOString() : null,
    })
    .eq('id', revocation_id);
  revalidatePath('/sigep/dashboard/revocations');
}

export async function createRevocationAction(
  _: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await getSession();
  if (!session) return { error: 'Accès refusé' };

  const case_id = formData.get('case_id') as string;
  const reason  = (formData.get('reason') as string)?.trim();
  if (!case_id || !reason) return { error: 'Champs obligatoires manquants' };

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

  return null;
}
