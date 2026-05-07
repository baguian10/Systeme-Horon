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
    if (!supabase) return DEMO_SESSION;

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;

    const { data: profile } = await supabase
      .from('users')
      .select('id, auth_id, role, full_name, badge_number, jurisdiction')
      .eq('auth_id', user.id)
      .single();

    if (!profile) return null;
    return profile as SessionUser;
  } catch {
    return DEMO_SESSION;
  }
}
