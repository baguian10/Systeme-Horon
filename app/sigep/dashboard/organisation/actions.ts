'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { allow } from '@/lib/auth/permissions';
import { writeAudit } from '@/lib/audit/log';

const isDemoMode = () =>
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const guard = (s: Awaited<ReturnType<typeof getSession>>) =>
  !!s && allow(s, s.role === 'SUPER_ADMIN', 'users.manage');

export async function createDepartmentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!guard(session)) return;
  const name = (formData.get('name') as string)?.trim();
  const type = ((formData.get('type') as string) || 'COURT').toUpperCase();
  const parent_id = (formData.get('parent_id') as string) || null;
  if (!name) return;
  if (!['COURT', 'JURISDICTION', 'UNIT'].includes(type)) return;
  if (isDemoMode()) { revalidatePath('/sigep/dashboard/organisation'); return; }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return;
  const { data } = await supabase.from('departments').insert({ name, type, parent_id }).select('id').single();
  await writeAudit({ userId: session!.id, action: 'CREATE_DEPARTMENT', tableName: 'departments', recordId: data?.id, newData: { name, type, parent_id } });
  revalidatePath('/sigep/dashboard/organisation');
}

export async function deleteDepartmentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!guard(session)) return;
  const id = formData.get('id') as string;
  if (!id) return;
  if (isDemoMode()) { revalidatePath('/sigep/dashboard/organisation'); return; }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return;
  // children + members are detached (ON DELETE SET NULL) by the FK constraints.
  await supabase.from('departments').delete().eq('id', id);
  await writeAudit({ userId: session!.id, action: 'DELETE_DEPARTMENT', tableName: 'departments', recordId: id });
  revalidatePath('/sigep/dashboard/organisation');
}

export async function assignUserDepartmentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!guard(session)) return;
  const userId = formData.get('userId') as string;
  const department_id = (formData.get('department_id') as string) || null;
  if (!userId) return;
  if (isDemoMode()) { revalidatePath('/sigep/dashboard/organisation'); return; }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.from('users').update({ department_id }).eq('id', userId);
  await writeAudit({ userId: session!.id, action: 'ASSIGN_DEPARTMENT', tableName: 'users', recordId: userId, newData: { department_id } });
  revalidatePath('/sigep/dashboard/organisation');
}
