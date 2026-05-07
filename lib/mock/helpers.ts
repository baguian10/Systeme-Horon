import {
  MOCK_CASES, MOCK_ALERTS, MOCK_USERS, MOCK_STATS, MOCK_POSITIONS, MOCK_DEVICES,
  MOCK_CASE_ASSIGNMENTS, MOCK_GEOFENCES,
} from './data';
import type { Case, Alert, User, OverviewStats, UserRole, Position, Device, Geofence } from '@/lib/supabase/types';

export const IS_DEMO_MODE =
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function fetchCases(role: UserRole, userId: string): Promise<Case[]> {
  if (IS_DEMO_MODE) {
    if (role === 'OPERATIONAL') {
      const assigned = MOCK_CASE_ASSIGNMENTS
        .filter((a) => a.operational_id === userId)
        .map((a) => a.case_id);
      return MOCK_CASES.filter((c) => assigned.includes(c.id));
    }
    if (role === 'JUDGE') return MOCK_CASES.filter((c) => c.judge_id === userId);
    return MOCK_CASES; // SUPER_ADMIN / STRATEGIC see all (STRATEGIC blocked at page level)
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

export async function fetchUsers(role?: UserRole, userId?: string): Promise<User[]> {
  if (IS_DEMO_MODE) {
    if (role === 'JUDGE') return MOCK_USERS.filter((u) => u.role === 'OPERATIONAL' && u.created_by === userId);
    return MOCK_USERS;
  }
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return [];
  const base = supabase.from('users').select('*').order('created_at', { ascending: false });
  const { data } = role === 'JUDGE' && userId
    ? await base.eq('role', 'OPERATIONAL').eq('created_by', userId)
    : await base;
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

export async function fetchUnassignedDevices(): Promise<Device[]> {
  if (IS_DEMO_MODE) return MOCK_DEVICES.filter((d) => !d.case_id);
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase.from('devices').select('*').is('case_id', null);
  return (data ?? []) as Device[];
}

export async function fetchOperationalUsers(): Promise<User[]> {
  if (IS_DEMO_MODE) return MOCK_USERS.filter((u) => u.role === 'OPERATIONAL' && u.is_active);
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase.from('users').select('*').eq('role', 'OPERATIONAL').eq('is_active', true);
  return (data ?? []) as User[];
}

export async function fetchCaseAssignments(caseId: string): Promise<Array<User & { assigned_at: string }>> {
  if (IS_DEMO_MODE) {
    return MOCK_CASE_ASSIGNMENTS
      .filter((a) => a.case_id === caseId)
      .map((a) => {
        const user = MOCK_USERS.find((u) => u.id === a.operational_id);
        return user ? { ...user, assigned_at: a.assigned_at } : null;
      })
      .filter(Boolean) as Array<User & { assigned_at: string }>;
  }
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('case_assignments')
    .select('assigned_at, operational:users!operational_id(*)')
    .eq('case_id', caseId);
  return (data ?? []).map((r) => ({ ...(r.operational as unknown as User), assigned_at: r.assigned_at }));
}

export async function fetchAllDevices(): Promise<Device[]> {
  if (IS_DEMO_MODE) return MOCK_DEVICES;
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase.from('devices').select('*').order('created_at', { ascending: false });
  return (data ?? []) as Device[];
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

export async function fetchGeofences(caseId?: string): Promise<Geofence[]> {
  if (IS_DEMO_MODE) {
    return caseId
      ? MOCK_GEOFENCES.filter((g) => g.case_id === caseId)
      : MOCK_GEOFENCES;
  }
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return [];
  const query = supabase.from('geofences').select('*').order('created_at', { ascending: false });
  const { data } = caseId ? await query.eq('case_id', caseId) : await query;
  return (data ?? []) as Geofence[];
}
