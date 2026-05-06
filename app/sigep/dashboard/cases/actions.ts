'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { canCreateCase, canManageGeofences, canUpdateCaseStatus } from '@/lib/auth/permissions';
import { IS_DEMO_MODE } from '@/lib/mock/helpers';

export async function createCaseAction(formData: FormData) {
  const session = await getSession();
  if (!session || !canCreateCase(session.role)) return;

  if (IS_DEMO_MODE) {
    // In demo mode redirect back to cases with a notice
    redirect('/sigep/dashboard/cases?demo=1');
  }

  const national_id = formData.get('national_id') as string;
  const court_order_date = formData.get('court_order_date') as string;
  const start_date = formData.get('start_date') as string | null;
  const notes = formData.get('notes') as string | null;

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  if (!supabase) return;

  // Look up individual
  const { data: individual } = await supabase
    .from('individuals')
    .select('id')
    .eq('national_id', national_id)
    .single();

  if (!individual) return;

  const caseNumber = `BJMK-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

  const { data: newCase, error } = await supabase
    .from('cases')
    .insert({
      individual_id: individual.id,
      judge_id: session.id,
      case_number: caseNumber,
      status: 'PENDING',
      court_order_date,
      start_date: start_date || null,
      notes: notes || null,
    })
    .select('id')
    .single();

  if (error || !newCase) return;

  revalidatePath('/sigep/dashboard/cases');
  redirect(`/sigep/dashboard/cases/${newCase.id}`);
}

export async function createGeofenceAction(formData: FormData) {
  const session = await getSession();
  if (!session || !canManageGeofences(session.role)) return;
  if (IS_DEMO_MODE) { revalidatePath('/sigep/dashboard/cases'); return; }

  const case_id = formData.get('case_id') as string;
  const name = formData.get('name') as string;
  const is_exclusion = formData.get('is_exclusion') === 'true';

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  if (!supabase) return;

  await supabase.from('geofences').insert({
    case_id, name, is_exclusion,
    area: { type: 'Polygon', coordinates: [] },
    created_by: session.id,
  });

  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
}

export async function updateCaseStatusAction(formData: FormData) {
  const session = await getSession();
  if (!session || !canUpdateCaseStatus(session.role)) return;
  if (IS_DEMO_MODE) { revalidatePath('/sigep/dashboard/cases'); return; }

  const case_id = formData.get('case_id') as string;
  const status = formData.get('status') as string;

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  if (!supabase) return;

  await supabase.from('cases').update({ status, updated_at: new Date().toISOString() }).eq('id', case_id);
  revalidatePath(`/sigep/dashboard/cases/${case_id}`);
  revalidatePath('/sigep/dashboard/cases');
}
