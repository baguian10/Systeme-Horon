'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { allow, canManageAgenda } from '@/lib/auth/permissions';
import type { ObligationType } from '@/lib/supabase/types';

const isDemoMode = () =>
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function getSupabase() {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  return createAdminClient();
}

const VALID_TYPES: ObligationType[] = ['TIG_SHIFT', 'CURFEW_CHECK', 'COURT_DATE', 'MONITORING_VISIT'];

export async function confirmObligationAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !allow(session, canManageAgenda(session.role), 'agenda')) {
    return { error: 'Permission refusée' };
  }
  const id = (formData.get('id') as string)?.trim();
  const is_confirmed = formData.get('is_confirmed') === 'true';
  if (!id) return { error: 'ID manquant' };

  if (isDemoMode()) {
    const { MOCK_AGENDA } = await import('@/lib/mock/data');
    const ob = MOCK_AGENDA.find((a) => a.id === id);
    if (!ob) return { error: 'Obligation introuvable' };
    ob.is_confirmed = is_confirmed;
    revalidatePath('/sigep/dashboard/agenda');
    return {};
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Erreur serveur' };
  const { error } = await supabase.from('obligations').update({ is_confirmed }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/sigep/dashboard/agenda');
  return {};
}

export async function deleteObligationAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !allow(session, canManageAgenda(session.role), 'agenda')) {
    return { error: 'Permission refusée' };
  }
  const id = (formData.get('id') as string)?.trim();
  if (!id) return { error: 'ID manquant' };

  if (isDemoMode()) {
    const { MOCK_AGENDA } = await import('@/lib/mock/data');
    const idx = MOCK_AGENDA.findIndex((a) => a.id === id);
    if (idx === -1) return { error: 'Obligation introuvable' };
    MOCK_AGENDA.splice(idx, 1);
    revalidatePath('/sigep/dashboard/agenda');
    return {};
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Erreur serveur' };
  const { error } = await supabase.from('obligations').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/sigep/dashboard/agenda');
  return {};
}

export async function createObligationAction(
  formData: FormData,
): Promise<{ error?: string; id?: string }> {
  const session = await getSession();
  if (!session || !allow(session, canManageAgenda(session.role), 'agenda')) {
    return { error: 'Permission refusée' };
  }

  const case_id        = (formData.get('case_id') as string)?.trim();
  const obligation_type = formData.get('obligation_type') as ObligationType;
  const title           = (formData.get('title') as string)?.trim();
  const scheduled_date  = (formData.get('scheduled_date') as string)?.trim();
  const start_time      = (formData.get('start_time') as string) || null;
  const end_time        = (formData.get('end_time') as string) || null;
  const location        = (formData.get('location') as string)?.trim() || null;

  if (!case_id || !obligation_type || !title || !scheduled_date) {
    return { error: 'Champs obligatoires manquants' };
  }
  if (!VALID_TYPES.includes(obligation_type)) return { error: 'Type invalide' };
  if (title.length > 200) return { error: 'Intitulé trop long (max 200 caractères)' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduled_date)) return { error: 'Date invalide' };

  if (isDemoMode()) {
    const { MOCK_AGENDA, MOCK_CASES } = await import('@/lib/mock/data');
    const c = MOCK_CASES.find((x) => x.id === case_id);
    if (!c) return { error: 'Dossier introuvable' };
    const individual_name =
      (c.individual as { full_name?: string } | null)?.full_name ??
      MOCK_AGENDA.find((a) => a.case_id === case_id)?.individual_name ??
      '—';
    const id = crypto.randomUUID();
    MOCK_AGENDA.push({
      id, case_id,
      case_number: c.case_number,
      individual_name,
      obligation_type, title, scheduled_date,
      start_time: start_time || null,
      end_time: end_time || null,
      location, is_confirmed: false,
    });
    revalidatePath('/sigep/dashboard/agenda');
    return { id };
  }

  const supabase = await getSupabase();
  if (!supabase) return { error: 'Erreur serveur' };
  const { data, error } = await supabase
    .from('obligations')
    .insert({
      case_id, obligation_type, title, scheduled_date,
      start_time: start_time || null,
      end_time: end_time || null,
      location,
      is_confirmed: false,
      created_by: session.id,
    })
    .select('id')
    .single();
  if (error) return { error: error.message };
  revalidatePath('/sigep/dashboard/agenda');
  return { id: data.id };
}
