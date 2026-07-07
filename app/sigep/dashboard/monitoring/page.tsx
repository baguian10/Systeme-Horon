import { redirect } from 'next/navigation';
import { fetchCases, fetchAlerts, fetchOperationalUsers, fetchRecentDeviceEvents, fetchLatestPositions, fetchGeofences } from '@/lib/mock/helpers';
import { getSession } from '@/lib/auth/session';
import type { LivePosition } from '@/hooks/usePositionFeed';
import type { CaseStatus } from '@/lib/supabase/types';
import MonitoringConsole, { type TriageAlert, type StreamEvent } from '@/components/realtime/MonitoringConsole';
import DemoControls from '@/components/realtime/DemoControls';
import AutoRefresh from '@/components/common/AutoRefresh';

export const metadata = { title: 'Monitoring temps réel — SIGEP' };
export const revalidate = 0;

export default async function MonitoringPage() {
  const session = await getSession();
  if (!session) return null;
  if (session.role === 'STRATEGIC') redirect('/sigep/dashboard'); // aggregate only

  const [cases, alerts, operationals, events, latestPositions, geofencesAll] = await Promise.all([
    fetchCases(session.role, session.id),
    fetchAlerts(session.role),
    fetchOperationalUsers().catch(() => []),
    fetchRecentDeviceEvents(60).catch(() => []),
    fetchLatestPositions().catch(() => []),
    fetchGeofences().catch(() => []),
  ]);

  const activeCases = cases.filter((c) => c.status === 'ACTIVE' || c.status === 'VIOLATION');

  // Latest fix per case. The cases query carries no position, so relying on
  // c.last_position left the console empty in real mode — join the positions
  // helper (also drives the live Traxbean overlay in demo) instead.
  const posByCase = new Map(latestPositions.map((p) => [p.case_id, p]));

  const initialPositions: LivePosition[] = activeCases
    .map((c) => ({ c, pos: posByCase.get(c.id) }))
    .filter(({ c, pos }) => pos != null && c.device != null)
    .map(({ c, pos }) => ({
      case_id: c.id, device_id: c.device!.id, case_number: c.case_number,
      status: c.status as CaseStatus, alert_count: c.alert_count ?? 0,
      latitude: pos!.latitude, longitude: pos!.longitude,
      speed_kmh: pos!.speed_kmh, recorded_at: pos!.recorded_at,
    }));

  const caseNum = new Map(cases.map((c) => [c.id, c.case_number]));
  const triageAlerts: TriageAlert[] = alerts.filter((a) => !a.is_resolved).map((a) => ({
    id: a.id, case_id: a.case_id, case_number: caseNum.get(a.case_id) ?? a.case_id.slice(0, 8),
    alert_type: a.alert_type, severity: a.severity, status: a.status ?? 'NEW',
    assigned_to: a.assigned_to ?? null, triggered_at: a.triggered_at, description: a.description,
    escalated_at: (a as { escalated_at?: string | null }).escalated_at ?? null,
    escalated_l2_at: (a as { escalated_l2_at?: string | null }).escalated_l2_at ?? null,
  }));

  // Real N1 escalation delay — drives the live SLA countdowns in the triage.
  const { getSettings } = await import('@/lib/settings');
  const escalateMinutes = (await getSettings()).escalate_minutes ?? 30;

  // Cron heartbeat + Traxbean token health (written by poll-traxbean each run).
  let cronCheckedAt: string | null = null;
  let traxbeanOk: boolean | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (sb) {
      const { data: st } = await sb.from('system_settings')
        .select('traxbean_auth_ok, traxbean_auth_checked_at').eq('id', 1).maybeSingle();
      traxbeanOk = (st as { traxbean_auth_ok?: boolean | null } | null)?.traxbean_auth_ok ?? null;
      cronCheckedAt = (st as { traxbean_auth_checked_at?: string | null } | null)?.traxbean_auth_checked_at ?? null;
    }
  }

  const initialEvents: StreamEvent[] = events.map((e) => ({
    id: e.id, kind: 'event', type: e.event_type, detail: e.detail, at: e.created_at,
    caseRef: e.case_number ?? e.case_id?.slice(0, 8) ?? '—',
  }));

  // Metrics
  const online = activeCases.filter((c) => c.device?.is_online).length;
  const battery = activeCases.filter((c) => (c.device?.battery_pct ?? 100) < 20).length;
  // Server Component renders once per request — Date.now() is deterministic here.
  // eslint-disable-next-line react-hooks/purity
  const stale = activeCases.filter((c) => c.device?.last_seen_at && (Date.now() - new Date(c.device.last_seen_at).getTime()) > 15 * 60_000).length;
  const violations = activeCases.filter((c) => c.status === 'VIOLATION').length;
  const ackDeltas = alerts.filter((a) => a.acknowledged_at).map((a) => (Date.parse(a.acknowledged_at as string) - Date.parse(a.triggered_at)) / 60_000);
  const resDeltas = alerts.filter((a) => a.resolved_at).map((a) => (Date.parse(a.resolved_at as string) - Date.parse(a.triggered_at)) / 60_000);
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((s, x) => s + x, 0) / arr.length) : null;
  const ingestionLastMs = initialPositions.length ? Math.max(...initialPositions.map((p) => Date.parse(p.recorded_at))) : null;

  const metrics = { online, offline: activeCases.length - online, violations, battery, stale, avgAckMin: avg(ackDeltas), avgResolveMin: avg(resDeltas) };

  // Per-case context for the incident panel (M) + quick commands.
  const caseInfo: Record<string, { label: string; imei: string | null; sim: string | null; risk: string | null; lat: number | null; lng: number | null; online: boolean }> = {};
  for (const c of activeCases) {
    const pos = posByCase.get(c.id);
    caseInfo[c.id] = {
      label: c.individual?.full_name ?? c.case_number,
      imei: c.device?.imei ?? null,
      sim: c.device?.sim_number ?? null,
      risk: c.risk_level ?? null,
      lat: pos?.latitude ?? c.last_position?.latitude ?? null,
      lng: pos?.longitude ?? c.last_position?.longitude ?? null,
      online: c.device?.is_online ?? false,
    };
  }

  return (
    <div className="space-y-3">
      {/* Data flows through the SSE stream (<3 s); this refresh only recomputes
          the server-side KPI metrics. */}
      <AutoRefresh intervalMs={30000} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Centre opérationnel — temps réel</h2>
          <p className="text-sm text-gray-500 mt-0.5">Triage des alertes, flux d&apos;activité et santé de la flotte en direct.</p>
        </div>
        <DemoControls />
      </div>
      <MonitoringConsole
        initialPositions={initialPositions}
        initialAlerts={triageAlerts}
        initialEvents={initialEvents}
        operationals={operationals.map((u) => ({ id: u.id, full_name: u.full_name }))}
        metrics={metrics}
        ingestionLastMs={ingestionLastMs}
        canResolve={true}
        caseInfo={caseInfo}
        escalateMinutes={escalateMinutes}
        meId={session.id}
        meName={session.full_name}
        cronCheckedAt={cronCheckedAt}
        traxbeanOk={traxbeanOk}
        geofences={geofencesAll
          .filter((g) => (g as { status?: string }).status !== 'REQUESTED')
          .map((g) => ({
            id: g.id, case_id: g.case_id, name: g.name,
            is_exclusion: g.is_exclusion,
            shape_type: (g.shape_type ?? 'POLYGON') as 'CIRCLE' | 'POLYGON',
            center_lat: (g as { center_lat?: number | null }).center_lat ?? null,
            center_lon: (g as { center_lon?: number | null }).center_lon ?? null,
            radius_m: (g as { radius_m?: number | null }).radius_m ?? null,
            area: (g as { area?: { coordinates: number[][][] } | null }).area ?? null,
          }))}
      />
    </div>
  );
}
