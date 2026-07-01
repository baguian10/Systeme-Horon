'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import { canViewUsers, canManageAllUsers, canManageOwnAgents } from '@/lib/auth/permissions';
import type { UserRole } from '@/lib/supabase/types';

const isDemoMode = () =>
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Returns true if the session may manage the target account:
//  - SUPER_ADMIN → anyone;
//  - JUDGE → only an OPERATIONAL agent they created (created_by = self).
// Reads the target via the admin client so created_by/role are authoritative.
async function canManageTarget(
  session: { id: string; role: UserRole },
  targetId: string,
): Promise<boolean> {
  if (canManageAllUsers(session.role)) return true;
  if (!canManageOwnAgents(session.role)) return false;
  if (isDemoMode()) {
    const { MOCK_USERS } = await import('@/lib/mock/data');
    const t = MOCK_USERS.find((u) => u.id === targetId);
    return t?.role === 'OPERATIONAL' && (t as { created_by?: string }).created_by === session.id;
  }
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return false;
  const { data } = await sb.from('users').select('role, created_by').eq('id', targetId).maybeSingle();
  const t = data as { role?: UserRole; created_by?: string | null } | null;
  return t?.role === 'OPERATIONAL' && t?.created_by === session.id;
}

// Roles each creator is allowed to provision
const ALLOWED_ROLES: Record<string, UserRole[]> = {
  SUPER_ADMIN: ['ADMIN', 'STRATEGIC', 'JUDGE', 'OPERATIONAL'],
  JUDGE: ['OPERATIONAL'],
};

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
  const phone = (formData.get('phone') as string)?.trim() || null;
  const access_scope = (formData.get('access_scope') as 'FULL' | 'RESTRICTED') || null;
  // Granular permissions for ADMIN accounts (checkboxes → repeated "permissions" fields).
  const permissions = role === 'ADMIN' ? (formData.getAll('permissions') as string[]) : [];

  if (!full_name || !email || !password || !role) {
    return { error: 'Veuillez remplir tous les champs obligatoires' };
  }
  if (password.length < 8) {
    return { error: 'Le mot de passe doit comporter au moins 8 caractères' };
  }

  const allowed = ALLOWED_ROLES[session.role] ?? [];
  if (!allowed.includes(role)) {
    return { error: `Votre rôle ne permet pas de créer un compte de type « ${role} »` };
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
      created_by: session.id,
      access_scope: role === 'OPERATIONAL' ? (access_scope ?? 'FULL') : null,
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
    phone,
    is_active: true,
    created_by: session.id,
    access_scope: role === 'OPERATIONAL' ? (access_scope ?? 'FULL') : null,
    permissions,
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

// ── Force password reset ─────────────────────────────────────────────────────

export async function forcePasswordResetAction(formData: FormData): Promise<{ error?: string; success?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Accès refusé' };

  const user_id = formData.get('user_id') as string;
  if (!user_id || user_id === session.id) return { error: 'Opération non autorisée' };
  if (!(await canManageTarget(session, user_id))) return { error: 'Accès refusé' };

  if (isDemoMode()) {
    const { writeAudit } = await import('@/lib/audit/log');
    await writeAudit({ userId: session.id, action: 'FORCE_PASSWORD_RESET', tableName: 'users', recordId: user_id });
    revalidatePath('/sigep/dashboard/users');
    return { success: 'Réinitialisation enregistrée (mode démo)' };
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };

  const { data: userData } = await supabase.from('users').select('auth_id').eq('id', user_id).single();
  if (!userData) return { error: 'Utilisateur introuvable' };

  const { data: authUser } = await supabase.auth.admin.getUserById(userData.auth_id);
  if (!authUser?.user?.email) return { error: 'Email introuvable pour cet utilisateur' };

  // generateLink only *builds* a recovery link (returned in data) — it never
  // delivers it, so the previous code reported success while sending nothing.
  // resetPasswordForEmail dispatches the recovery email via Supabase Auth SMTP.
  const { error: resetErr } = await supabase.auth.resetPasswordForEmail(authUser.user.email);
  if (resetErr) return { error: "Échec de l'envoi du lien de réinitialisation" };

  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'FORCE_PASSWORD_RESET', tableName: 'users', recordId: user_id });

  revalidatePath('/sigep/dashboard/users');
  return { success: `Lien de réinitialisation envoyé à ${authUser.user.email}` };
}

// ── Toggle active state ───────────────────────────────────────────────────────

export async function toggleUserActiveAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const user_id = formData.get('user_id') as string;
  const next_active = formData.get('next_active') === 'true';
  if (!user_id || user_id === session.id) return; // cannot toggle self
  if (!(await canManageTarget(session, user_id))) return;

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

// ── Update granular permissions (ADMIN accounts) ─────────────────────────────

export async function updateUserPermissionsAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canManageAllUsers(session.role)) return;
  const user_id = formData.get('user_id') as string;
  const permissions = formData.getAll('permissions') as string[];
  if (!user_id) return;

  if (isDemoMode()) { revalidatePath('/sigep/dashboard/users'); return; }
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.from('users').update({ permissions, updated_at: new Date().toISOString() }).eq('id', user_id);
  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'UPDATE_PERMISSIONS', tableName: 'users', recordId: user_id, newData: { permissions } });
  revalidatePath('/sigep/dashboard/users');
}

// ── Delete user (hard delete) ────────────────────────────────────────────────

export async function deleteUserAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || !canManageAllUsers(session.role)) return;
  const user_id = formData.get('user_id') as string;
  if (!user_id || user_id === session.id) return; // cannot delete self

  if (isDemoMode()) {
    const { MOCK_USERS } = await import('@/lib/mock/data');
    const i = MOCK_USERS.findIndex((u) => u.id === user_id);
    if (i !== -1) MOCK_USERS.splice(i, 1);
    revalidatePath('/sigep/dashboard/users');
    return;
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return;

  const { data: u } = await supabase.from('users').select('auth_id').eq('id', user_id).single();
  await supabase.from('users').delete().eq('id', user_id);
  if (u?.auth_id) { try { await supabase.auth.admin.deleteUser(u.auth_id); } catch {} }

  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'DELETE_USER', tableName: 'users', recordId: user_id });
  revalidatePath('/sigep/dashboard/users');
}
