import {
  MOCK_CASES, MOCK_ALERTS, MOCK_USERS, MOCK_STATS, MOCK_POSITIONS, MOCK_DEVICES,
  MOCK_CASE_ASSIGNMENTS, MOCK_GEOFENCES, MOCK_TIG_SITES,
  MOCK_REVOCATIONS, MOCK_JOURNAL_ENTRIES, MOCK_MAINTENANCE_TICKETS, MOCK_AGENDA,
  MOCK_THREADS, MOCK_MESSAGES, MOCK_VIOLATION_HEATPOINTS,
} from './data';
import type { Case, Alert, User, OverviewStats, UserRole, Position, Device, Geofence, TigSite, RevocationRequest, JournalEntry, MaintenanceTick, AgendaObligation, MessageThread, Message, ViolationHeatPoint } from '@/lib/supabase/types';

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

export async function fetchTigSites(): Promise<TigSite[]> {
  if (IS_DEMO_MODE) return MOCK_TIG_SITES;
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase.from('tig_sites').select('*').order('created_at', { ascending: false });
  return (data ?? []) as TigSite[];
}

export async function fetchViolations(role: UserRole): Promise<Alert[]> {
  const alerts = await fetchAlerts(role);
  return alerts
    .filter((a) => ['GEOFENCE_EXIT', 'TAMPER_DETECTED'].includes(a.alert_type))
    .sort((a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime());
}

export async function fetchRevocations(role: UserRole, userId: string): Promise<RevocationRequest[]> {
  if (IS_DEMO_MODE) {
    if (role === 'JUDGE') {
      const judgedCases = MOCK_CASES.filter((c) => c.judge_id === userId).map((c) => c.id);
      return MOCK_REVOCATIONS.filter((r) => judgedCases.includes(r.case_id));
    }
    if (role === 'OPERATIONAL') {
      const assignedCaseIds = MOCK_CASE_ASSIGNMENTS.filter((a) => a.operational_id === userId).map((a) => a.case_id);
      return MOCK_REVOCATIONS.filter((r) => assignedCaseIds.includes(r.case_id));
    }
    return MOCK_REVOCATIONS;
  }
  return MOCK_REVOCATIONS;
}

export async function fetchJournalEntries(caseId: string): Promise<JournalEntry[]> {
  if (IS_DEMO_MODE) {
    return MOCK_JOURNAL_ENTRIES.filter((e) => e.case_id === caseId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  return [];
}

export async function fetchMaintenanceTickets(): Promise<MaintenanceTick[]> {
  if (IS_DEMO_MODE) {
    return MOCK_MAINTENANCE_TICKETS.sort((a, b) => b.priority - a.priority);
  }
  return [];
}

export async function fetchAgenda(role: UserRole, userId: string): Promise<AgendaObligation[]> {
  if (IS_DEMO_MODE) {
    if (role === 'OPERATIONAL') {
      const assignedCaseIds = MOCK_CASE_ASSIGNMENTS.filter((a) => a.operational_id === userId).map((a) => a.case_id);
      return MOCK_AGENDA.filter((a) => assignedCaseIds.includes(a.case_id));
    }
    if (role === 'JUDGE') {
      const judgedCaseIds = MOCK_CASES.filter((c) => c.judge_id === userId).map((c) => c.id);
      return MOCK_AGENDA.filter((a) => judgedCaseIds.includes(a.case_id));
    }
    return MOCK_AGENDA;
  }
  return [];
}

export async function fetchThreads(userId: string): Promise<MessageThread[]> {
  if (IS_DEMO_MODE) {
    return MOCK_THREADS
      .filter((t) => t.participant_ids.includes(userId))
      .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
  }
  return [];
}

export async function fetchMessages(threadId: string): Promise<Message[]> {
  if (IS_DEMO_MODE) {
    return MOCK_MESSAGES
      .filter((m) => m.thread_id === threadId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  return [];
}

export async function fetchViolationHeatPoints(): Promise<ViolationHeatPoint[]> {
  if (IS_DEMO_MODE) return MOCK_VIOLATION_HEATPOINTS;
  return [];
}
