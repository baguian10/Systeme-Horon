'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Activity, AlertTriangle, Bell, CircleDot, Maximize2, Clock, Radio, ListFilter } from 'lucide-react';
import { AlertTypeBadge } from '@/components/ui/StatusBadge';
import AlertActions from '@/components/alerts/AlertActions';
import { useAlertFeed } from '@/hooks/useAlertFeed';
import type { LivePosition } from '@/hooks/usePositionFeed';

const LiveMapGrid = dynamic(() => import('@/components/realtime/LiveMapGrid'), { ssr: false });

export interface TriageAlert {
  id: string; case_id: string; case_number: string; alert_type: string;
  severity: number; status: string; assigned_to: string | null; triggered_at: string; description: string | null;
}
export interface StreamEvent {
  id: string; kind: 'event' | 'alert'; type: string; detail: string | null; at: string; caseRef: string;
}
interface Metrics { online: number; offline: number; violations: number; battery: number; stale: number; avgAckMin: number | null; avgResolveMin: number | null }

const EVENT_LABEL: Record<string, string> = {
  ONLINE: 'Reprise contact', OFFLINE: 'Perte contact', COMMAND: 'Commande', RESTART: 'Redémarrage',
  TAMPER: 'Sabotage', LOW_BATTERY: 'Batterie faible', SIM_CHANGE: 'SIM modifiée', ASSIGN: 'Assignation',
  GEOFENCE_EXIT: 'Sortie de zone', CURFEW_VIOLATION: 'Couvre-feu', TAMPER_DETECTED: 'Sabotage',
  PANIC_BUTTON: 'Panique', BATTERY_LOW: 'Batterie faible', SIGNAL_LOST: 'Signal perdu', HEALTH_CRITICAL: 'Santé',
};
const EVENT_COLOR: Record<string, string> = {
  TAMPER: 'text-red-600', TAMPER_DETECTED: 'text-red-600', PANIC_BUTTON: 'text-red-600',
  GEOFENCE_EXIT: 'text-orange-600', CURFEW_VIOLATION: 'text-violet-600', OFFLINE: 'text-gray-500',
  ONLINE: 'text-emerald-600', LOW_BATTERY: 'text-amber-600', BATTERY_LOW: 'text-amber-600',
};

function ago(at: string, now: number) {
  const s = Math.max(0, Math.floor((now - Date.parse(at)) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h`;
}

export default function MonitoringConsole({
  initialPositions, initialAlerts, initialEvents, operationals, metrics, ingestionLastMs, canResolve,
}: {
  initialPositions: LivePosition[];
  initialAlerts: TriageAlert[];
  initialEvents: StreamEvent[];
  operationals: { id: string; full_name: string }[];
  metrics: Metrics;
  ingestionLastMs: number | null;
  canResolve: boolean;
}) {
  const [tab, setTab] = useState<'triage' | 'stream'>('triage');
  const [alerts, setAlerts] = useState<TriageAlert[]>(initialAlerts);
  const [events, setEvents] = useState<StreamEvent[]>(initialEvents);
  const [now, setNow] = useState(0);
  const [connected, setConnected] = useState(false);
  const [streamFilter, setStreamFilter] = useState<'all' | 'violations' | 'technical'>('all');
  const [flash, setFlash] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const caseRefByCase = useMemo(() => {
    const m = new Map<string, string>();
    initialPositions.forEach((p) => m.set(p.case_id, p.case_number));
    return m;
  }, [initialPositions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);

  // H — live device-event stream.
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import('@/lib/supabase/client').then(({ createClient, IS_DEMO_MODE }) => {
      if (IS_DEMO_MODE) { setConnected(true); return; }
      const supabase = createClient();
      if (!supabase) return;
      const stale = supabase.getChannels().find((c) => c.topic === 'realtime:monitoring-events');
      if (stale) supabase.removeChannel(stale);
      const channel = supabase.channel('monitoring-events')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'device_events' }, (payload) => {
          const r = payload.new as { id: string; event_type: string; detail: string | null; created_at: string; case_id: string | null };
          setEvents((prev) => [{ id: r.id, kind: 'event' as const, type: r.event_type, detail: r.detail, at: r.created_at, caseRef: (r.case_id && caseRefByCase.get(r.case_id)) || r.case_id?.slice(0, 8) || '—' }, ...prev].slice(0, 200));
        })
        .subscribe((s) => setConnected(s === 'SUBSCRIBED'));
      cleanup = () => { supabase.removeChannel(channel); };
    });
    return () => { cleanup?.(); };
  }, [caseRefByCase]);

  // I — new alert: prepend to triage + stream + flash.
  useAlertFeed(useCallback((a) => {
    const ta: TriageAlert = { id: a.id, case_id: a.case_id, case_number: (a.case as { case_number?: string } | undefined)?.case_number ?? caseRefByCase.get(a.case_id) ?? a.case_id.slice(0, 8), alert_type: a.alert_type, severity: a.severity, status: a.status ?? 'NEW', assigned_to: a.assigned_to ?? null, triggered_at: a.triggered_at, description: a.description };
    setAlerts((prev) => prev.some((x) => x.id === a.id) ? prev : [ta, ...prev]);
    setEvents((prev) => [{ id: `a-${a.id}`, kind: 'alert' as const, type: a.alert_type, detail: a.description, at: a.triggered_at, caseRef: ta.case_number }, ...prev].slice(0, 200));
    setFlash(true); setTimeout(() => setFlash(false), 4000);
  }, [caseRefByCase]));

  const openAlerts = useMemo(() => alerts.slice().sort((a, b) => b.severity - a.severity || Date.parse(a.triggered_at) - Date.parse(b.triggered_at)), [alerts]);

  function sla(at: string) {
    const min = (now - Date.parse(at)) / 60_000;
    if (min < 5) return { cls: 'text-emerald-600', label: `${ago(at, now)}`, escalate: false };
    if (min < 15) return { cls: 'text-amber-600', label: `${ago(at, now)}`, escalate: false };
    return { cls: 'text-red-600', label: `${ago(at, now)}`, escalate: true };
  }

  const streamView = useMemo(() => events.filter((e) => {
    if (streamFilter === 'all') return true;
    const violation = ['GEOFENCE_EXIT', 'CURFEW_VIOLATION', 'TAMPER', 'TAMPER_DETECTED', 'PANIC_BUTTON'].includes(e.type);
    return streamFilter === 'violations' ? violation : !violation;
  }), [events, streamFilter]);

  const ingestionLabel = ingestionLastMs ? ago(new Date(ingestionLastMs).toISOString(), now) : '—';
  const ingestionStale = ingestionLastMs ? (now - ingestionLastMs) > 15 * 60_000 : true;

  const KPIS = [
    { label: 'En ligne', v: metrics.online, cls: 'text-emerald-700' },
    { label: 'Hors ligne', v: metrics.offline, cls: 'text-gray-500' },
    { label: 'Violations', v: metrics.violations, cls: 'text-red-700' },
    { label: 'Batterie', v: metrics.battery, cls: 'text-amber-700' },
    { label: 'Sans contact', v: metrics.stale, cls: 'text-orange-700' },
    { label: 'Tps réponse', v: metrics.avgAckMin != null ? `${metrics.avgAckMin}min` : '—', cls: 'text-blue-700' },
  ];

  return (
    <div ref={rootRef} className="space-y-3 bg-gray-50">
      {flash && <div className="flex items-center gap-2 bg-red-600 text-white rounded-xl px-4 py-2 text-sm font-semibold animate-pulse"><Bell className="w-4 h-4" /> Nouvelle alerte reçue</div>}

      {/* J — KPI + health */}
      <div className="flex flex-wrap items-stretch gap-2">
        {KPIS.map((k) => (
          <div key={k.label} className="flex-1 min-w-[90px] rounded-xl border border-gray-100 bg-white px-3 py-2 text-center">
            <p className={`text-xl font-bold ${k.cls}`}>{k.v}</p>
            <p className="text-[10px] text-gray-500">{k.label}</p>
          </div>
        ))}
        <div className="flex flex-col justify-center gap-1 rounded-xl border border-gray-100 bg-white px-3 py-2">
          <span data-tip="Connexion au flux temps réel" className={`flex items-center gap-1 text-[11px] font-medium ${connected ? 'text-emerald-600' : 'text-gray-400'}`}><CircleDot className="w-3 h-3" />{connected ? 'Temps réel actif' : 'Reconnexion…'}</span>
          <span data-tip="Dernière position reçue de la flotte" className={`flex items-center gap-1 text-[11px] ${ingestionStale ? 'text-red-500' : 'text-gray-500'}`}><Radio className="w-3 h-3" />Ingestion : {ingestionLabel}</span>
        </div>
        <button onClick={() => rootRef.current?.requestFullscreen?.()} data-tip="Mode mur de contrôle (plein écran)" className="rounded-xl border border-gray-100 bg-white px-3 text-gray-600 hover:text-gray-900"><Maximize2 className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 h-[calc(100vh-15rem)]">
        {/* Map */}
        <div className="xl:col-span-3 rounded-2xl overflow-hidden border border-gray-100 min-h-[360px]">
          <LiveMapGrid initialPositions={initialPositions} />
        </div>

        {/* Triage / Stream */}
        <div className="xl:col-span-2 flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden min-h-[360px]">
          <div className="flex border-b border-gray-50">
            <button onClick={() => setTab('triage')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium ${tab === 'triage' ? 'text-red-600 border-b-2 border-red-500' : 'text-gray-500'}`}>
              <AlertTriangle className="w-4 h-4" /> Triage ({openAlerts.length})
            </button>
            <button onClick={() => setTab('stream')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium ${tab === 'stream' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500'}`}>
              <Activity className="w-4 h-4" /> Flux d&apos;activité
            </button>
          </div>

          {tab === 'triage' ? (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {openAlerts.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">Aucune alerte en cours ✓</div>
              ) : openAlerts.map((a) => {
                const s = sla(a.triggered_at);
                return (
                  <div key={a.id} className={`px-3 py-2.5 ${s.escalate && a.status === 'NEW' ? 'bg-red-50/60' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <AlertTypeBadge type={a.alert_type as never} />
                      <span data-tip="Temps écoulé depuis le déclenchement (SLA)" className={`flex items-center gap-1 text-[11px] font-semibold ${s.cls} ${s.escalate && a.status === 'NEW' ? 'animate-pulse' : ''}`}><Clock className="w-3 h-3" />{s.label}</span>
                    </div>
                    {a.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.description}</p>}
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <Link href={`/sigep/dashboard/cases/${a.case_id}`} className="text-[11px] text-blue-600 hover:underline font-mono">{a.case_number}</Link>
                      {canResolve && <AlertActions alertId={a.id} status={a.status} assignedTo={a.assigned_to} users={operationals} />}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-gray-50 flex items-center gap-1.5">
                <ListFilter className="w-3.5 h-3.5 text-gray-400" />
                {(['all', 'violations', 'technical'] as const).map((f) => (
                  <button key={f} onClick={() => setStreamFilter(f)} className={`px-2 py-0.5 rounded-full text-[11px] ${streamFilter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {f === 'all' ? 'Tout' : f === 'violations' ? 'Violations' : 'Technique'}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                {streamView.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-400">Aucun événement.</div>
                ) : streamView.map((e) => (
                  <div key={e.id} className="px-3 py-2 flex items-center gap-2.5 text-sm">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${e.kind === 'alert' ? 'bg-red-500' : 'bg-gray-300'}`} />
                    <span className={`font-medium ${EVENT_COLOR[e.type] ?? 'text-gray-700'}`}>{EVENT_LABEL[e.type] ?? e.type}</span>
                    <span className="flex-1 min-w-0 truncate text-xs text-gray-400">{e.caseRef}{e.detail ? ` · ${e.detail}` : ''}</span>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">{ago(e.at, now)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
