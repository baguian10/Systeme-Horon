import type { SessionUser } from '@/lib/supabase/types';
import { MOCK_USERS } from '@/lib/mock/data';

// Demo session — 0=SUPER_ADMIN (baguian10), 1=STRATEGIC, 2=JUDGE, 3=OPERATIONAL
const DEMO_USER_INDEX = 0;

const DEMO_SESSION: SessionUser = {
  id: MOCK_USERS[DEMO_USER_INDEX].id,
  auth_id: MOCK_USERS[DEMO_USER_INDEX].auth_id,
  role: MOCK_USERS[DEMO_USER_INDEX].role,
  full_name: MOCK_USERS[DEMO_USER_INDEX].full_name,
  badge_number: MOCK_USERS[DEMO_USER_INDEX].badge_number,
  jurisdiction: MOCK_USERS[DEMO_USER_INDEX].jurisdiction,
};

export async function getSession(): Promise<SessionUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return DEMO_SESSION;

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    // Supabase configured but client unavailable → deny (never elevate to demo).
    if (!supabase) return null;

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    const { data: profile } = await supabase
      .from('users')
      .select('id, auth_id, role, full_name, badge_number, jurisdiction, permissions, is_active, expires_at')
      .eq('auth_id', user.id)
      .single();

    if (!profile) return null;
    // Suspended account → no session (blocked everywhere).
    if ((profile as { is_active?: boolean }).is_active === false) return null;
    // End of mission reached (expires_at) → account no longer grants access.
    const expiresAt = (profile as { expires_at?: string | null }).expires_at;
    if (expiresAt && Date.parse(expiresAt) < Date.now()) return null;
    return profile as SessionUser;
  } catch {
    // On any failure with Supabase configured, DENY — never fall back to a
    // privileged demo session in production (prevents privilege escalation).
    return null;
  }
}
