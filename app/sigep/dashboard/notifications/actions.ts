'use server';

import { getSession } from '@/lib/auth/session';

const isDemoMode = () =>
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Persists the current user's notification preferences (alert type × channel).
// The form serialises its state into a single "prefs" JSON field.
export async function saveNotificationPrefsAction(
  _: { ok?: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string } | null> {
  const session = await getSession();
  if (!session) return { error: 'Accès refusé' };

  const raw = formData.get('prefs') as string;
  let prefs: unknown;
  try {
    prefs = JSON.parse(raw);
  } catch {
    return { error: 'Préférences invalides' };
  }
  if (typeof prefs !== 'object' || prefs === null) return { error: 'Préférences invalides' };

  if (isDemoMode()) return { ok: true };

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { error: 'Base de données indisponible' };
  const { error } = await supabase
    .from('users')
    .update({ notification_prefs: prefs })
    .eq('id', session.id);
  if (error) return { error: "Échec de l'enregistrement" };
  return { ok: true };
}
