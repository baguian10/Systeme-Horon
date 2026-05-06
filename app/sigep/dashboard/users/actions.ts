'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { canViewUsers } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/supabase/types';

const isDemoMode = () => !process.env.NEXT_PUBLIC_SUPABASE_URL;

// ── Create user ───────────────────────────────────────────────────────────────

export async function createUserAction(
  _: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const session = await getSession();
  if (!session || !canViewUsers(session.role)) return { error: 'Accès refusé' };

  const full_name = (formData.get('full_name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim();
  const password = formData.get('password') as string;
  const role = formData.get('role') as UserRole;
  const badge_number = (formData.get('badge_number') as string)?.trim() || null;
  const jurisdiction = (formData.get('jurisdiction') as string)?.trim() || null;

  if (!full_name || !email || !password || !role) {
    return { error: 'Veuillez remplir tous les champs obligatoires' };
  }
  if (password.length < 8) {
    return { error: 'Le mot de passe doit comporter au moins 8 caractères' };
  }

  if (isDemoMode()) {
    const { MOCK_USERS } = await import('@/lib/mock/data');
    const already = MOCK_USERS.find((u) => u.badge_number === badge_number && badge_number);
    if (already) return { error: 'Ce numéro de badge est déjà utilisé' };
    const newId = `u-${Date.now()}`;
    MOCK_USERS.push({
      id: newId,
      auth_id: `a-${Date.now()}`,
      role,
      full_name,
      badge_number,
      jurisdiction,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    revalidatePath('/sigep/dashboard/users');
    return null;
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };

  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr || !authData.user) return { error: authErr?.message ?? 'Erreur de création du compte' };

  const { error: userErr } = await supabase.from('users').insert({
    auth_id: authData.user.id,
    role,
    full_name,
    badge_number: badge_number || null,
    jurisdiction: jurisdiction || null,
    is_active: true,
  });
  if (userErr) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return { error: 'Erreur lors de la création du profil utilisateur' };
  }

  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'CREATE_USER', tableName: 'users', newData: { full_name, role } });

  revalidatePath('/sigep/dashboard/users');
  return null;
}

// ── Toggle active state ───────────────────────────────────────────────────────

export async function toggleUserActiveAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canViewUsers(session.role)) return;

  const user_id = formData.get('user_id') as string;
  const next_active = formData.get('next_active') === 'true';
  if (!user_id || user_id === session.id) return; // cannot toggle self

  if (isDemoMode()) {
    const { MOCK_USERS } = await import('@/lib/mock/data');
    const u = MOCK_USERS.find((u) => u.id === user_id);
    if (u) { u.is_active = next_active; u.updated_at = new Date().toISOString(); }
    revalidatePath('/sigep/dashboard/users');
    return;
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return;

  await supabase.from('users').update({ is_active: next_active, updated_at: new Date().toISOString() }).eq('id', user_id);

  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({
    userId: session.id,
    action: next_active ? 'REACTIVATE_USER' : 'DEACTIVATE_USER',
    tableName: 'users',
    recordId: user_id,
  });

  revalidatePath('/sigep/dashboard/users');
}
