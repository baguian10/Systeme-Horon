'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { allow } from '@/lib/auth/permissions';
import { writeAudit } from '@/lib/audit/log';

const isDemoMode = () =>
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const guard = (s: Awaited<ReturnType<typeof getSession>>) =>
  !!s && allow(s, s.role === 'SUPER_ADMIN', 'users.manage');

async function getSupabase() {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  return createAdminClient();
}

const VALID_TYPES = ['COURT', 'JURISDICTION', 'UNIT'];

// Traverses the parent chain from candidateParentId upward; returns true if
// deptId appears — which would make the reparent a cycle.
async function wouldCreateCycle(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabase>>>,
  deptId: string,
  candidateParentId: string,
): Promise<boolean> {
  if (candidateParentId === deptId) return true;
  const { data } = await supabase.from('departments').select('id, parent_id');
  const parentOf = new Map<string, string | null>();
  for (const d of (data ?? []) as { id: string; parent_id: string | null }[]) {
    parentOf.set(d.id, d.parent_id);
  }
  let cur: string | null = candidateParentId;
  const seen = new Set<string>();
  while (cur) {
    if (seen.has(cur)) break;
    seen.add(cur);
    const parent: string | null = parentOf.get(cur) ?? null;
    if (parent === deptId) return true;
    cur = parent;
  }
  return false;
}

export async function createDepartmentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!guard(session)) return;
  const name = (formData.get('name') as string)?.trim();
  const type = ((formData.get('type') as string) || 'COURT').toUpperCase();
  const parent_id = (formData.get('parent_id') as string) || null;
  if (!name || name.length > 120 || !VALID_TYPES.includes(type)) return;
  if (isDemoMode()) { revalidatePath('/sigep/dashboard/organisation'); return; }

  const supabase = await getSupabase();
  if (!supabase) return;
  // Forged parent_id → verify the parent exists before inserting.
  if (parent_id) {
    const { data: parent } = await supabase.from('departments').select('id').eq('id', parent_id).maybeSingle();
    if (!parent) return;
  }
  const { data } = await supabase.from('departments').insert({ name, type, parent_id }).select('id').single();
  await writeAudit({ userId: session!.id, action: 'CREATE_DEPARTMENT', tableName: 'departments', recordId: data?.id, newData: { name, type, parent_id } });
  revalidatePath('/sigep/dashboard/organisation');
}

export async function updateDepartmentAction(formData: FormData): Promise<{ error?: string } | void> {
  const session = await getSession();
  if (!guard(session)) return;
  const id = formData.get('id') as string;
  const name = (formData.get('name') as string)?.trim();
  const type = ((formData.get('type') as string) || 'COURT').toUpperCase();
  const parent_id = (formData.get('parent_id') as string) || null;
  if (!id || !name) return;
  if (name.length > 120) return { error: 'Nom trop long (max 120 caractères)' };
  if (!VALID_TYPES.includes(type)) return;
  if (isDemoMode()) { revalidatePath('/sigep/dashboard/organisation'); return; }

  const supabase = await getSupabase();
  if (!supabase) return;
  if (parent_id) {
    const { data: parent } = await supabase.from('departments').select('id').eq('id', parent_id).maybeSingle();
    if (!parent) return { error: 'Entité parente introuvable' };
    const circular = await wouldCreateCycle(supabase, id, parent_id);
    if (circular) return { error: "Rattachement impossible : cela créerait une boucle dans l'arbre." };
  }
  const { error: updErr } = await supabase.from('departments').update({ name, type, parent_id }).eq('id', id);
  if (updErr) return { error: 'Erreur lors de la mise à jour' };
  await writeAudit({ userId: session!.id, action: 'UPDATE_DEPARTMENT', tableName: 'departments', recordId: id, newData: { name, type, parent_id } });
  revalidatePath('/sigep/dashboard/organisation');
}

export async function deleteDepartmentAction(formData: FormData): Promise<{ error?: string } | void> {
  const session = await getSession();
  if (!guard(session)) return;
  const id = formData.get('id') as string;
  if (!id) return;
  if (isDemoMode()) { revalidatePath('/sigep/dashboard/organisation'); return; }

  const supabase = await getSupabase();
  if (!supabase) return;
  // Three guards, explicit errors — the raw DB failure was silently swallowed:
  // attached cases, child entities, assigned members.
  const [{ count: caseCount }, { count: childCount }, { count: memberCount }] = await Promise.all([
    supabase.from('cases').select('id', { count: 'exact', head: true }).eq('department_id', id),
    supabase.from('departments').select('id', { count: 'exact', head: true }).eq('parent_id', id),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('department_id', id),
  ]);
  if (caseCount && caseCount > 0) {
    return { error: `${caseCount} dossier(s) rattaché(s) à cette entité. Transférez-les avant suppression.` };
  }
  if (childCount && childCount > 0) {
    return { error: `${childCount} entité(s) enfant(s) rattachée(s). Détachez ou supprimez-les d'abord.` };
  }
  if (memberCount && memberCount > 0) {
    return { error: `${memberCount} agent(s) affecté(s) à cette entité. Réaffectez-les avant suppression.` };
  }
  const { error: delErr } = await supabase.from('departments').delete().eq('id', id);
  if (delErr) return { error: 'Suppression refusée par la base de données' };
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

  const supabase = await getSupabase();
  if (!supabase) return;
  // Forged department_id → verify it exists (null = unassign, always allowed).
  if (department_id) {
    const { data: dept } = await supabase.from('departments').select('id').eq('id', department_id).maybeSingle();
    if (!dept) return;
  }
  await supabase.from('users').update({ department_id }).eq('id', userId);
  await writeAudit({ userId: session!.id, action: 'ASSIGN_DEPARTMENT', tableName: 'users', recordId: userId, newData: { department_id } });
  revalidatePath('/sigep/dashboard/organisation');
}
