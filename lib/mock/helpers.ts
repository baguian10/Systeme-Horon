import {
  MOCK_CASES, MOCK_ALERTS, MOCK_USERS, MOCK_STATS, MOCK_POSITIONS,
} from './data';
import type { Case, Alert, User, OverviewStats, UserRole, Position } from '@/lib/supabase/types';

export const IS_DEMO_MODE =
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function fetchCases(role: UserRole, userId: string): Promise<Case[]> {
  if (IS_DEMO_MODE) {
    if (role === 'OPERATIONAL') return MOCK_CASES.slice(0, 2);
    if (role === 'JUDGE') return MOCK_CASES;
    return MOCK_CASES;
  }
  // Real Supabase query — RLS handles filtering automatically
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('cases')
    .select('*, individual:individuals(*), judge:users!judge_id(*), device:devices(*)')
    .order('created_at', { ascending: false });
  return (data ?? []) as Case[];
}

export async function fetchCaseById(id: string): Promise<Case | null> {
  if (IS_DEMO_MODE) return MOCK_CASES.find((c) => c.id === id) ?? null;
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from('cases')
    .select('*, individual:individuals(*), judge:users!judge_id(*), device:devices(*), geofences(*), alerts(*)')
    .eq('id', id)
    .single();
  return (data as Case) ?? null;
}

export async function fetchAlerts(role: UserRole): Promise<Alert[]> {
  if (IS_DEMO_MODE) return MOCK_ALERTS;
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('alerts')
    .select('*, case:cases(case_number, status), device:devices(imei)')
    .order('triggered_at', { ascending: false });
  return (data ?? []) as Alert[];
}

export async function fetchUsers(): Promise<User[]> {
  if (IS_DEMO_MODE) return MOCK_USERS;
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
  return (data ?? []) as User[];
}

export async function fetchOverviewStats(): Promise<OverviewStats> {
  if (IS_DEMO_MODE) return MOCK_STATS;
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  if (!supabase) return MOCK_STATS;
  const [
    { count: active_cases },
    { count: active_alerts },
    { count: devices_online },
    { count: violation_cases },
  ] = await Promise.all([
    supabase.from('cases').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('is_resolved', false),
    supabase.from('devices').select('id', { count: 'exact', head: true }).eq('is_online', true),
    supabase.from('cases').select('id', { count: 'exact', head: true }).eq('status', 'VIOLATION'),
  ]);
  return {
    active_cases: active_cases ?? 0,
    active_alerts: active_alerts ?? 0,
    devices_online: devices_online ?? 0,
    monitored_individuals: (active_cases ?? 0) + (violation_cases ?? 0),
    violation_cases: violation_cases ?? 0,
  };
}

export async function fetchLatestPositions(): Promise<(Position & { case_number: string })[]> {
  if (IS_DEMO_MODE) {
    return MOCK_POSITIONS.map((p, i) => ({
      ...p,
      case_number: MOCK_CASES[i]?.case_number ?? '',
    }));
  }
  return [];
}
