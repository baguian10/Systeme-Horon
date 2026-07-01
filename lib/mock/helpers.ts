import {
  MOCK_CASES, MOCK_ALERTS, MOCK_USERS, MOCK_STATS, MOCK_POSITIONS, MOCK_DEVICES,
  MOCK_CASE_ASSIGNMENTS, MOCK_GEOFENCES, MOCK_TIG_SITES,
  MOCK_REVOCATIONS, MOCK_JOURNAL_ENTRIES, MOCK_MAINTENANCE_TICKETS, MOCK_AGENDA,
  MOCK_THREADS, MOCK_MESSAGES, MOCK_VIOLATION_HEATPOINTS,
} from './data';
import type { Case, Alert, AlertType, User, OverviewStats, UserRole, Position, Device, Geofence, TigSite, RevocationRequest, JournalEntry, MaintenanceTick, AgendaObligation, MessageThread, Message, ViolationHeatPoint, CaseRequest } from '@/lib/supabase/types';
import { isTraxbeanConfigured, getDeviceLocation } from '@/lib/traxbean/client';

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
  // Admin-level roles (SUPER_ADMIN, delegated ADMIN) have no RLS read policy →
  // use the admin client to see every case. Other roles stay RLS-scoped.
  let supabase;
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    supabase = createAdminClient();
  } else {
    const { createClient } = await import('@/lib/supabase/server');
    supabase = await createClient();
  }
  if (!supabase) return [];
  const [{ data }, { data: alertRows }] = await Promise.all([
    supabase
      .from('cases')
      .select('*, individual:individuals(*), judge:users!judge_id(*), device:devices(*)')
      .order('created_at', { ascending: false }),
    // Active-alert count per case — populates the "Alertes" badge that was
    // always empty in real mode (the cases query carries no aggregate).
    supabase.from('alerts').select('case_id').eq('is_resolved', false),
  ]);
  const alertCounts = new Map<string, number>();
  for (const a of (alertRows ?? []) as { case_id: string }[]) {
    alertCounts.set(a.case_id, (alertCounts.get(a.case_id) ?? 0) + 1);
  }
  return ((data ?? []) as Case[]).map((c) => ({ ...c, alert_count: alertCounts.get(c.id) ?? 0 }));
}

export async function fetchCaseById(id: string): Promise<Case | null> {
  if (IS_DEMO_MODE) return MOCK_CASES.find((c) => c.id === id) ?? null;
  // Admin-level roles bypass RLS via the admin client so they can open any dossier.
  const { getSession } = await import('@/lib/auth/session');
  const session = await getSession();
  let supabase;
  if (session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN') {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    supabase = createAdminClient();
  } else {
    const { createClient } = await import('@/lib/supabase/server');
    supabase = await createClient();
  }
  if (!supabase) return null;
  const { data } = await supabase
    .from('cases')
    .select('*, individual:individuals(*), judge:users!judge_id(*), device:devices(*), geofences(*), alerts(*), department:departments(name)')
    .eq('id', id)
    .single();
  const caseRow = (data as Case) ?? null;
  if (caseRow) {
    // The cases query carries no position — attach the latest fix so the
    // dossier's "Dernière position connue" card works in real mode.
    const { data: pos } = await supabase
      .from('positions')
      .select('latitude, longitude, recorded_at, accuracy_m, speed_kmh')
      .eq('case_id', id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pos) caseRow.last_position = pos as Case['last_position'];
  }
  return caseRow;
}

export async function fetchAlerts(_role: UserRole): Promise<Alert[]> {
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
  const base = supabase
    .from('users')
    .select('*, creator:users!created_by(full_name)')
    .order('created_at', { ascending: false });
  const { data } = role === 'JUDGE' && userId
    ? await base.eq('role', 'OPERATIONAL').eq('created_by', userId)
    : await base;
  type Row = User & { creator?: { full_name?: string } | null };
  const users = ((data ?? []) as Row[]).map((u) => ({ ...u, created_by_name: u.creator?.full_name ?? null }));

  // Per-judge caseload count (super admin view) — needed to gate deletion and
  // drive the transfer UI. One aggregate read, tallied in memory.
  if (role !== 'JUDGE') {
    const { data: caseRows } = await supabase.from('cases').select('judge_id');
    const counts = new Map<string, number>();
    for (const c of (caseRows ?? []) as { judge_id: string | null }[]) {
      if (c.judge_id) counts.set(c.judge_id, (counts.get(c.judge_id) ?? 0) + 1);
    }
    return users.map((u) => (u.role === 'JUDGE' ? { ...u, case_count: counts.get(u.id) ?? 0 } : u));
  }
  return users;
}

// Aggregate stats are global system figures (no PII). Roles without an RLS read
// policy on cases — SUPER_ADMIN, delegated ADMIN, STRATEGIC — must count through
// the service role, otherwise every aggregate comes back 0. JUDGE/OPERATIONAL
// keep their RLS-scoped view.
async function statsClient(role?: UserRole) {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'STRATEGIC') {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    return createAdminClient();
  }
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

// Case-scoped reads: admin roles bypass RLS via the service role; JUDGE and
// OPERATIONAL stay RLS-scoped to their own / assigned cases.
async function caseScopedClient(role: UserRole) {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    return createAdminClient();
  }
  const { createClient } = await import('@/lib/supabase/server');
  return createClient();
}

export async function fetchOverviewStats(role?: UserRole): Promise<OverviewStats> {
  if (IS_DEMO_MODE) return MOCK_STATS;
  const supabase = await statsClient(role);
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

// PII-free status distribution for the aggregate stats view (selects only the
// status column, so it is safe to expose to STRATEGIC). Counts the whole system.
export async function fetchCaseStatusCounts(): Promise<Record<string, number>> {
  const tally: Record<string, number> = {};
  if (IS_DEMO_MODE) {
    for (const c of MOCK_CASES) tally[c.status] = (tally[c.status] ?? 0) + 1;
    return tally;
  }
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return tally;
  const { data } = await supabase.from('cases').select('status');
  for (const r of (data ?? []) as { status: string }[]) tally[r.status] = (tally[r.status] ?? 0) + 1;
  return tally;
}

// PII-free alert distribution (type column + resolved flag only). Counts the
// whole system, for the aggregate stats view.
export async function fetchAlertTypeCounts(): Promise<{ byType: Record<string, number>; total: number; resolved: number }> {
  const byType: Record<string, number> = {};
  let total = 0;
  let resolved = 0;
  const add = (type: string, isResolved: boolean) => {
    byType[type] = (byType[type] ?? 0) + 1;
    total += 1;
    if (isResolved) resolved += 1;
  };
  if (IS_DEMO_MODE) {
    for (const a of MOCK_ALERTS) add(a.alert_type, a.is_resolved);
    return { byType, total, resolved };
  }
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { byType, total, resolved };
  const { data } = await supabase.from('alerts').select('alert_type, is_resolved');
  for (const r of (data ?? []) as { alert_type: string; is_resolved: boolean }[]) add(r.alert_type, r.is_resolved);
  return { byType, total, resolved };
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
    const positions = MOCK_POSITIONS.map((p, i) => ({
      ...p,
      case_number: MOCK_CASES[i]?.case_number ?? '',
    }));

    // Live overlay: replace the first case's position with the real TR40 ankle
    // tracker pulled from the Traxbean platform, so the SIGEP map shows the
    // physical device moving in real time during testing. Set TRAXBEAN_TOKEN
    // and TRAXBEAN_DEMO_IMEI to enable; otherwise the mock position is kept.
    const demoImei = process.env.TRAXBEAN_DEMO_IMEI;
    if (isTraxbeanConfigured() && demoImei && positions[0]) {
      const live = await getDeviceLocation(demoImei);
      if (live) {
        positions[0] = {
          ...positions[0],
          latitude: live.lat,
          longitude: live.lng,
          speed_kmh: live.speedKmh ?? 0,
          recorded_at: live.recordedAt,
        };
      }
    }

    return positions;
  }

  // Real mode — latest position per case from Supabase.
  // SUPER_ADMIN has no RLS read policy on positions → use the admin client so
  // the surveillance map is populated for them too (other roles stay RLS-scoped).
  const { getSession } = await import('@/lib/auth/session');
  const session = await getSession();
  let supabase;
  if (session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN') {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    supabase = createAdminClient();
  } else {
    const { createClient } = await import('@/lib/supabase/server');
    supabase = await createClient();
  }
  if (!supabase) return [];
  const { data } = await supabase
    .from('positions')
    .select('*, case:cases(case_number)')
    .order('recorded_at', { ascending: false })
    .limit(500);
  if (!data) return [];

  const seen = new Set<string>();
  const latest: (Position & { case_number: string })[] = [];
  for (const row of data as (Position & { case?: { case_number: string } | null })[]) {
    if (seen.has(row.case_id)) continue;
    seen.add(row.case_id);
    latest.push({ ...row, case_number: row.case?.case_number ?? '' });
  }
  return latest;
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
  // Behavioural infractions: perimeter exit, curfew breach, tampering. Curfew
  // was previously excluded, so couvre-feu violations never reached this view.
  const INFRACTION_TYPES = ['GEOFENCE_EXIT', 'CURFEW_VIOLATION', 'TAMPER_DETECTED'];
  return alerts
    .filter((a) => INFRACTION_TYPES.includes(a.alert_type))
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
  const supabase = await caseScopedClient(role);
  if (!supabase) return [];
  const { data } = await supabase
    .from('revocations')
    .select('*, case:cases(case_number, individual:individuals(full_name)), requester:users!requested_by_id(full_name)')
    .order('created_at', { ascending: false });
  type Row = RevocationRequest & {
    case?: { case_number?: string; individual?: { full_name?: string } | null } | null;
    requester?: { full_name?: string } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, case_id: r.case_id,
    case_number: r.case?.case_number ?? '',
    individual_name: r.case?.individual?.full_name ?? '—',
    requested_by_id: r.requested_by_id ?? '',
    requested_by_name: r.requester?.full_name ?? '—',
    reason: r.reason, violation_count: r.violation_count ?? 0,
    status: r.status, judge_decision: r.judge_decision, decided_at: r.decided_at,
    created_at: r.created_at,
  }));
}

export async function fetchJournalEntries(caseId: string): Promise<JournalEntry[]> {
  if (IS_DEMO_MODE) {
    return MOCK_JOURNAL_ENTRIES.filter((e) => e.case_id === caseId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  // Case detail already gates access to the case; read via the admin client
  // filtered by case_id and join the author for display.
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('journal_entries')
    .select('*, author:users!author_id(full_name, role)')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });
  type Row = JournalEntry & { author?: { full_name?: string; role?: UserRole } | null; author_name?: string | null };
  return ((data ?? []) as unknown as Row[]).map((e) => ({
    id: e.id, case_id: e.case_id, author_id: e.author_id,
    // Live author, else the snapshot (account deleted), else placeholder.
    author_name: e.author?.full_name ?? e.author_name ?? 'Compte supprimé', author_role: e.author?.role ?? 'OPERATIONAL',
    entry_type: e.entry_type, content: e.content, created_at: e.created_at,
  }));
}

export interface RecentDeviceEvent {
  id: string;
  event_type: string;
  detail: string | null;
  created_at: string;
  case_id: string | null;
  case_number?: string | null;
}

export async function fetchRecentDeviceEvents(limit = 60): Promise<RecentDeviceEvent[]> {
  if (IS_DEMO_MODE) return [];
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('device_events')
    .select('id, event_type, detail, created_at, case_id, case:cases(case_number)')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((e) => ({
    id: e.id as string,
    event_type: e.event_type as string,
    detail: (e.detail as string | null) ?? null,
    created_at: e.created_at as string,
    case_id: (e.case_id as string | null) ?? null,
    case_number: (e as { case?: { case_number?: string } | null }).case?.case_number ?? null,
  }));
}

export async function fetchMaintenanceTickets(): Promise<MaintenanceTick[]> {
  if (IS_DEMO_MODE) {
    return MOCK_MAINTENANCE_TICKETS.sort((a, b) => b.priority - a.priority);
  }
  // SUPER_ADMIN-only view — served through the admin client (RLS has no
  // JUDGE/OPERATIONAL read policy for maintenance).
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('maintenance_tickets')
    .select('*, device:devices(imei)')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
  type Row = MaintenanceTick & { device?: { imei?: string } | null };
  return ((data ?? []) as unknown as Row[]).map((t) => ({
    id: t.id, device_id: t.device_id, device_imei: t.device?.imei ?? '—',
    maintenance_type: t.maintenance_type, status: t.status, priority: t.priority,
    description: t.description, assigned_to: t.assigned_to,
    scheduled_at: t.scheduled_at, completed_at: t.completed_at, notes: t.notes,
    created_at: t.created_at,
  }));
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
  const supabase = await caseScopedClient(role);
  if (!supabase) return [];
  const { data } = await supabase
    .from('obligations')
    .select('*, case:cases(case_number, individual:individuals(full_name))')
    .order('scheduled_date', { ascending: true });
  type Row = AgendaObligation & {
    case?: { case_number?: string; individual?: { full_name?: string } | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((o) => ({
    id: o.id, case_id: o.case_id,
    case_number: o.case?.case_number ?? '',
    individual_name: o.case?.individual?.full_name ?? '—',
    obligation_type: o.obligation_type, title: o.title,
    scheduled_date: o.scheduled_date, start_time: o.start_time, end_time: o.end_time,
    location: o.location, is_confirmed: o.is_confirmed,
  }));
}

export async function fetchThreads(userId: string): Promise<MessageThread[]> {
  if (IS_DEMO_MODE) {
    return MOCK_THREADS
      .filter((t) => t.participant_ids.includes(userId))
      .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());
  }
  // Participant-scoped — served through the admin client filtered to threads the
  // user takes part in (the messaging model doesn't fit the case-RLS pattern).
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('message_threads')
    .select('*, case:cases(case_number)')
    .contains('participant_ids', [userId])
    .order('last_message_at', { ascending: false });
  type Row = MessageThread & { case?: { case_number?: string } | null };
  return ((data ?? []) as unknown as Row[]).map((t) => ({
    id: t.id, case_id: t.case_id, case_number: t.case?.case_number ?? null,
    subject: t.subject, participant_ids: t.participant_ids ?? [],
    last_message_at: t.last_message_at, last_message_preview: t.last_message_preview ?? '',
    created_by: t.created_by, created_at: t.created_at,
  }));
}

export async function fetchMessages(threadId: string): Promise<Message[]> {
  if (IS_DEMO_MODE) {
    return MOCK_MESSAGES
      .filter((m) => m.thread_id === threadId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('messages')
    .select('*, sender:users!sender_id(full_name, role)')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  type Row = Message & { sender?: { full_name?: string; role?: UserRole } | null; sender_name?: string | null };
  return ((data ?? []) as unknown as Row[]).map((m) => ({
    id: m.id, thread_id: m.thread_id, sender_id: m.sender_id,
    // Live sender, else the snapshot (account deleted), else placeholder.
    sender_name: m.sender?.full_name ?? m.sender_name ?? 'Compte supprimé', sender_role: m.sender?.role ?? 'OPERATIONAL',
    content: m.content, is_read_by: m.is_read_by ?? [], created_at: m.created_at,
  }));
}

export async function fetchViolationHeatPoints(role: UserRole): Promise<ViolationHeatPoint[]> {
  if (IS_DEMO_MODE) return MOCK_VIOLATION_HEATPOINTS;
  // Real heat = past behavioural-violation alerts that carry a GPS position.
  // Intensity uses the alert severity (1-5), which the heatmap colour scale
  // already expects. Case-scoped: JUDGE/OPERATIONAL see their own via RLS,
  // admin roles see the whole system.
  const supabase = await caseScopedClient(role);
  if (!supabase) return [];
  const { data } = await supabase
    .from('alerts')
    .select('alert_type, severity, position_lat, position_lon')
    .in('alert_type', ['GEOFENCE_EXIT', 'CURFEW_VIOLATION', 'TAMPER_DETECTED'])
    .not('position_lat', 'is', null)
    .not('position_lon', 'is', null)
    .limit(5000);
  type Row = { alert_type: AlertType; severity: number | null; position_lat: number; position_lon: number };
  return ((data ?? []) as unknown as Row[]).map((a) => ({
    lat: a.position_lat,
    lng: a.position_lon,
    intensity: Math.min(5, Math.max(1, a.severity ?? 1)),
    alert_type: a.alert_type,
  }));
}

// Real system-health signal: timestamp of the most recent ingested position.
// Powers the SUPER_ADMIN health card (freshness = ingestion pipeline alive).
export async function fetchSystemHealth(): Promise<{ lastIngestionAt: string | null }> {
  if (IS_DEMO_MODE) {
    const latest = MOCK_POSITIONS.reduce<string | null>(
      (acc, p) => (!acc || new Date(p.recorded_at) > new Date(acc) ? p.recorded_at : acc),
      null,
    );
    return { lastIngestionAt: latest };
  }
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return { lastIngestionAt: null };
  const { data } = await supabase
    .from('positions')
    .select('recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { lastIngestionAt: (data?.recorded_at as string | undefined) ?? null };
}

// Case requests (institutional workflow). SUPER_ADMIN sees all via the admin
// client; JUDGE sees their own cases' requests via RLS.
export async function fetchCaseRequests(role: UserRole): Promise<CaseRequest[]> {
  if (IS_DEMO_MODE) return [];
  const supabase = await caseScopedClient(role);
  if (!supabase) return [];
  const { data } = await supabase
    .from('case_requests')
    .select('*, case:cases(case_number, individual:individuals(full_name)), requester:users!requested_by(full_name)')
    .order('created_at', { ascending: false });
  type Row = CaseRequest & {
    case?: { case_number?: string; individual?: { full_name?: string } | null } | null;
    requester?: { full_name?: string } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, case_id: r.case_id,
    case_number: r.case?.case_number ?? '',
    individual_name: r.case?.individual?.full_name ?? '—',
    request_type: r.request_type, requested_by: r.requested_by,
    requested_by_name: r.requester?.full_name ?? '—',
    reason: r.reason, payload: r.payload, status: r.status,
    decided_by: r.decided_by, decision_note: r.decision_note, decided_at: r.decided_at,
    created_at: r.created_at,
  }));
}

// Non-permanent active measures whose end_date falls within `withinDays`.
// Drives the dashboard "échéances" card. Case-scoped like the rest.
export type ExpiringMeasure = { id: string; case_number: string; individual_name: string; end_date: string; days_left: number };
export async function fetchExpiringMeasures(role: UserRole, userId: string, withinDays = 30): Promise<ExpiringMeasure[]> {
  if (IS_DEMO_MODE) {
    const now = Date.now();
    return MOCK_CASES
      .filter((c) => (c.status === 'ACTIVE' || c.status === 'VIOLATION') && !c.is_permanent && c.end_date)
      .map((c) => ({ id: c.id, case_number: c.case_number, individual_name: c.individual?.full_name ?? '—', end_date: c.end_date!,
        days_left: Math.ceil((new Date(c.end_date!).getTime() - now) / 86400000) }))
      .filter((m) => m.days_left <= withinDays)
      .sort((a, b) => a.days_left - b.days_left);
  }
  const supabase = role === 'SUPER_ADMIN' || role === 'ADMIN'
    ? (await import('@/lib/supabase/admin')).createAdminClient()
    : await (await import('@/lib/supabase/server')).createClient();
  if (!supabase) return [];
  const horizon = new Date(Date.now() + withinDays * 86400000).toISOString();
  const { data } = await supabase
    .from('cases')
    .select('id, case_number, end_date, individual:individuals(full_name)')
    .in('status', ['ACTIVE', 'VIOLATION'])
    .eq('is_permanent', false)
    .not('end_date', 'is', null)
    .lte('end_date', horizon)
    .order('end_date', { ascending: true });
  const now = Date.now();
  type Row = { id: string; case_number: string; end_date: string; individual?: { full_name?: string } | null };
  return ((data ?? []) as unknown as Row[]).map((c) => ({
    id: c.id, case_number: c.case_number,
    individual_name: c.individual?.full_name ?? '—',
    end_date: c.end_date,
    days_left: Math.ceil((new Date(c.end_date).getTime() - now) / 86400000),
  }));
}

// Last known fix per device, for active cases that have no position of their
// own yet (bracelet just reassigned → history carries the old case_id). Admin
// roles only, via the service role, so a scoped role never sees another case's
// track. Returns positions re-labelled with the NEW case_id/number.
export async function fetchDeviceFallbackPositions(
  role: UserRole,
  pairs: { caseId: string; caseNumber: string; deviceId: string }[],
): Promise<(Position & { case_number: string })[]> {
  if (pairs.length === 0) return [];
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') return [];
  if (IS_DEMO_MODE) return [];
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return [];
  const out: (Position & { case_number: string })[] = [];
  await Promise.all(pairs.map(async (p) => {
    const { data } = await supabase
      .from('positions')
      .select('*')
      .eq('device_id', p.deviceId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) out.push({ ...(data as Position), case_id: p.caseId, case_number: p.caseNumber });
  }));
  return out;
}

export type ServiceStatus = { label: string; state: 'ok' | 'warn' | 'down'; detail: string };

// Real service-health signals for the parametres page (replaces a hardcoded
// "all green" block). Each row reflects something actually measurable.
export async function fetchServiceStatus(): Promise<ServiceStatus[]> {
  const out: ServiceStatus[] = [];

  if (IS_DEMO_MODE) {
    out.push({ label: 'Base de données', state: 'warn', detail: 'Mode démonstration (données simulées)' });
    out.push({ label: 'Ingestion GPS', state: 'warn', detail: 'Simulateur en mémoire' });
  } else {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    let dbOk = false;
    let smsEnabled = false;
    let smsProvider: string | null = null;
    let traxbeanAuthOk: boolean | null = null;
    let traxbeanCheckedAt: string | null = null;
    if (sb) {
      try {
        const { data, error } = await sb.from('system_settings').select('sms_enabled, sms_provider, traxbean_auth_ok, traxbean_auth_checked_at').eq('id', 1).maybeSingle();
        dbOk = !error;
        smsEnabled = Boolean(data?.sms_enabled);
        smsProvider = (data?.sms_provider as string | null) ?? null;
        traxbeanAuthOk = (data as { traxbean_auth_ok?: boolean | null } | null)?.traxbean_auth_ok ?? null;
        traxbeanCheckedAt = (data as { traxbean_auth_checked_at?: string | null } | null)?.traxbean_auth_checked_at ?? null;
      } catch { dbOk = false; }
    }
    out.push({ label: 'Base de données', state: dbOk ? 'ok' : 'down', detail: dbOk ? 'Connectée (Supabase)' : 'Injoignable' });

    const health = await fetchSystemHealth();
    const ageMin = health.lastIngestionAt
      ? Math.max(0, Math.floor((Date.now() - new Date(health.lastIngestionAt).getTime()) / 60000))
      : null;
    out.push(
      ageMin === null ? { label: 'Ingestion GPS', state: 'warn', detail: 'Aucune position reçue' }
      : ageMin < 15   ? { label: 'Ingestion GPS', state: 'ok',   detail: `Dernière position il y a ${ageMin} min` }
      : ageMin < 60   ? { label: 'Ingestion GPS', state: 'warn', detail: `Retard — ${ageMin} min` }
      :                 { label: 'Ingestion GPS', state: 'down', detail: `Aucune position depuis ${Math.floor(ageMin / 60)} h` },
    );
    out.push({ label: 'Passerelle SMS', state: smsEnabled ? 'ok' : 'warn', detail: smsEnabled ? (smsProvider ?? 'Activée') : 'Désactivée' });

    // Real Traxbean auth state, from the last poll health-check.
    const checkedAgo = traxbeanCheckedAt ? Math.floor((Date.now() - Date.parse(traxbeanCheckedAt)) / 60000) : null;
    out.push(
      !isTraxbeanConfigured() ? { label: 'Plateforme GPS (Traxbean)', state: 'warn', detail: 'Non configurée (TRAXBEAN_TOKEN absent)' }
      : traxbeanAuthOk === true  ? { label: 'Plateforme GPS (Traxbean)', state: 'ok',   detail: `Connectée${checkedAgo !== null ? ` (vérifié il y a ${checkedAgo} min)` : ''}` }
      : traxbeanAuthOk === false ? { label: 'Plateforme GPS (Traxbean)', state: 'down', detail: 'Token expiré / injoignable — suivi bracelets interrompu' }
      :                            { label: 'Plateforme GPS (Traxbean)', state: 'warn', detail: 'État inconnu (aucune vérification récente)' },
    );
  }
  return out;
}
