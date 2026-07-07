'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Activity, AlertTriangle, Bell, CircleDot, Maximize2, Clock, Radio, ListFilter, Volume2, VolumeX, Crosshair, Phone, X, MapPin, ShieldAlert } from 'lucide-react';
import { AlertTypeBadge, RiskBadge } from '@/components/ui/StatusBadge';
import AlertActions from '@/components/alerts/AlertActions';
import { useRealtimeStream, type StreamAlert } from '@/hooks/useRealtimeStream';
import type { LivePosition } from '@/hooks/usePositionFeed';
import type { CaseStatus } from '@/lib/supabase/types';
import type { TrackerMarker } from '@/components/map/TrackingMap';
import type { RiskLevel } from '@/lib/supabase/types';

const LiveMapGrid = dynamic(() => import('@/components/realtime/LiveMapGrid'), { ssr: false });
const TrackingMap = dynamic(() => import('@/components/map/TrackingMap'), { ssr: false });
const IncidentReplay = dynamic(() => import('@/components/realtime/IncidentReplay'), { ssr: false });

interface CaseCtx { label: string; imei: string | null; sim: string | null; risk: string | null; lat: number | null; lng: number | null; online: boolean }

// L — severity-based audio cue (Web Audio, no asset).
function beep(severity: number, muted: boolean) {
  if (muted) return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const pulses = severity >= 4 ? 3 : 1;
    const freq = severity >= 4 ? 880 : 540;
    for (let i = 0; i < pulses; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.frequency.value = freq;
      const t = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.04); g.gain.linearRampToValueAtTime(0, t + 0.16);
      o.start(t); o.stop(t + 0.18);
    }
    setTimeout(() => ctx.close(), 1200);
  } catch { /* ignore */ }
}

export interface TriageAlert {
  id: string; case_id: string; case_number: string; alert_type: string;
  severity: number; status: string; assigned_to: string | null; triggered_at: string; description: string | null;
  escalated_at?: string | null; escalated_l2_at?: string | null;
}
export interface StreamEvent {
  id: string; kind: 'event' | 'alert'; type: string; detail: string | null; at: string; caseRef: string;
}
interface Metrics { online: number; offline: number; violations: number; battery: number; stale: number; avgAckMin: number | null; avgResolveMin: number | null }

const EVENT_LABEL: Record<string, string> = {
  ONLINE: 'Reprise contact', OFFLINE: 'Perte contact', COMMAND: 'Commande', RESTART: 'Redémarrage',
  TAMPER: 'Sabotage', LOW_BATTERY: 'Batterie faible', SIM_CHANGE: 'SIM modifiée', ASSIGN: 'Assignation',
  GEOFENCE_EXIT: 'Sortie de zone', BLE_EXIT: 'Sortie domicile (BLE)', CURFEW_VIOLATION: 'Couvre-feu', TAMPER_DETECTED: 'Sabotage',
  PANIC_BUTTON: 'Panique', BATTERY_LOW: 'Batterie faible', SIGNAL_LOST: 'Signal réseau', HEALTH_CRITICAL: 'Santé',
};
const EVENT_COLOR: Record<string, string> = {
  TAMPER: 'text-red-600', TAMPER_DETECTED: 'text-red-600', PANIC_BUTTON: 'text-red-600',
  GEOFENCE_EXIT: 'text-orange-600', BLE_EXIT: 'text-blue-600', CURFEW_VIOLATION: 'text-violet-600', OFFLINE: 'text-gray-500',
  ONLINE: 'text-emerald-600', LOW_BATTERY: 'text-amber-600', BATTERY_LOW: 'text-amber-600',
};

function ago(at: string, now: number) {
  const s = Math.max(0, Math.floor((now - Date.parse(at)) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}min` : `${Math.floor(m / 60)}h`;
}

// Tiny inline sparkline (last ~30 min of KPI samples).
function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div style={{ height: 14 }} />;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 60},${12 - ((v - min) / range) * 10}`).join(' ');
  return (
    <svg width={60} height={14} className="mx-auto block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
    </svg>
  );
}

export default function MonitoringConsole({
  initialPositions, initialAlerts, initialEvents, operationals, metrics, ingestionLastMs, canResolve, caseInfo = {}, geofences = [],
  escalateMinutes = 30, meId = '', meName = '',
}: {
  initialPositions: LivePosition[];
  initialAlerts: TriageAlert[];
  initialEvents: StreamEvent[];
  operationals: { id: string; full_name: string }[];
  metrics: Metrics;
  ingestionLastMs: number | null;
  canResolve: boolean;
  caseInfo?: Record<string, CaseCtx>;
  geofences?: import('./LiveTrackingMap').MapGeofenceLite[];
  escalateMinutes?: number;
  meId?: string;
  meName?: string;
}) {
  const [tab, setTab] = useState<'triage' | 'stream'>('triage');
  const [alerts, setAlerts] = useState<TriageAlert[]>(initialAlerts);
  const [events, setEvents] = useState<StreamEvent[]>(initialEvents);
  const [livePos, setLivePos] = useState<LivePosition[]>(initialPositions);
  const [now, setNow] = useState(0);
  const [demoConnected, setDemoConnected] = useState(false);
  const [streamFilter, setStreamFilter] = useState<'all' | 'violations' | 'technical'>('all');
  const [flash, setFlash] = useState(false);
  const [muted, setMuted] = useState(false);
  const [incident, setIncident] = useState<string | null>(null); // case_id
  const [incidentTrigger, setIncidentTrigger] = useState<string | null>(null); // alert triggered_at (replay window)
  const [incidentTrail, setIncidentTrail] = useState<[number, number][] | null>(null);
  const [replayMode, setReplayMode] = useState(false);
  const [locateMsg, setLocateMsg] = useState<string | null>(null);
  const [crisis, setCrisis] = useState(false);
  const [cycleCase, setCycleCase] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const mutedRef = useRef(false);
  // KPI history for the sparklines — one sample per metrics refresh (~30 s).
  const [kpiHist, setKpiHist] = useState<Record<string, number[]>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { if (localStorage.getItem('horon.mon.muted') === '1') setMuted(true); } catch { /* ignore */ }
  }, []);
  useEffect(() => { mutedRef.current = muted; try { localStorage.setItem('horon.mon.muted', muted ? '1' : '0'); } catch { /* ignore */ } }, [muted]);

  const caseRefByCase = useMemo(() => {
    const m = new Map<string, string>();
    initialPositions.forEach((p) => m.set(p.case_id, p.case_number));
    return m;
  }, [initialPositions]);

  // Server re-render (AutoRefresh) re-seeds initialPositions — merge, newer fix wins.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLivePos((prev) => {
      const byId = new Map(prev.map((p) => [p.case_id, p]));
      for (const p of initialPositions) {
        const ex = byId.get(p.case_id);
        if (!ex || Date.parse(p.recorded_at) >= Date.parse(ex.recorded_at)) byId.set(p.case_id, p);
      }
      return Array.from(byId.values());
    });
  }, [initialPositions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    // 1 s tick — drives the live SLA countdowns.
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Demo mode: the simulator engine still drives positions/alerts via the map
  // grid + toast provider; mark the console connected.
  useEffect(() => {
    import('@/lib/supabase/client').then(({ IS_DEMO_MODE }) => {
      if (IS_DEMO_MODE) setDemoConnected(true);
    });
  }, []);

  // Unified SSE stream (prod): positions + alerts + state changes + device
  // events, < 3 s end-to-end, auto-resuming (Last-Event-ID).
  const { connected: sseConnected } = useRealtimeStream({
    onPosition: useCallback((p: { case_id: string; device_id: string; latitude: number; longitude: number; speed_kmh: number | null; recorded_at: string; case_number: string | null; status: string | null }) => {
      setLivePos((prev) => {
        const ex = prev.find((x) => x.case_id === p.case_id);
        if (ex && Date.parse(p.recorded_at) < Date.parse(ex.recorded_at)) return prev;
        const merged: LivePosition = {
          case_id: p.case_id,
          device_id: p.device_id,
          case_number: p.case_number ?? ex?.case_number ?? p.case_id.slice(0, 8),
          status: (p.status as CaseStatus | null) ?? ex?.status ?? 'ACTIVE',
          alert_count: ex?.alert_count ?? 0,
          latitude: p.latitude,
          longitude: p.longitude,
          speed_kmh: p.speed_kmh,
          recorded_at: p.recorded_at,
        };
        return ex ? prev.map((x) => x.case_id === p.case_id ? merged : x) : [...prev, merged];
      });
    }, []),
    onAlert: useCallback((a: StreamAlert) => {
      const ta: TriageAlert = {
        id: a.id, case_id: a.case_id,
        case_number: a.case_number ?? caseRefByCase.get(a.case_id) ?? a.case_id.slice(0, 8),
        alert_type: a.alert_type, severity: a.severity,
        status: a.status ?? 'NEW', assigned_to: a.assigned_to ?? null,
        triggered_at: a.triggered_at, description: a.description,
        escalated_at: a.escalated_at ?? null, escalated_l2_at: a.escalated_l2_at ?? null,
      };
      setAlerts((prev) => prev.some((x) => x.id === a.id) ? prev : [ta, ...prev]);
      setEvents((prev) => [{ id: `a-${a.id}`, kind: 'alert' as const, type: a.alert_type, detail: a.description, at: a.triggered_at, caseRef: ta.case_number }, ...prev].slice(0, 200));
      setFlash(true); setTimeout(() => setFlash(false), 4000);
      beep(a.severity, mutedRef.current); // L
    }, [caseRefByCase]),
    onAlertUpdate: useCallback((a: StreamAlert) => {
      setAlerts((prev) => {
        if (a.is_resolved) return prev.filter((x) => x.id !== a.id);
        return prev.map((x) => x.id === a.id
          ? {
              ...x,
              status: a.status ?? x.status,
              assigned_to: a.assigned_to ?? x.assigned_to,
              escalated_at: a.escalated_at ?? x.escalated_at,
              escalated_l2_at: a.escalated_l2_at ?? x.escalated_l2_at,
            }
          : x);
      });
    }, []),
    onEvent: useCallback((e: { id: string; event_type: string; detail: string | null; created_at: string; case_id: string | null; case_number: string | null }) => {
      setEvents((prev) => prev.some((x) => x.id === e.id) ? prev : [{
        id: e.id, kind: 'event' as const, type: e.event_type, detail: e.detail,
        at: e.created_at, caseRef: e.case_number ?? e.case_id?.slice(0, 8) ?? '—',
      }, ...prev].slice(0, 200));
    }, []),
  });
  const connected = sseConnected || demoConnected;

  // M — open the incident panel for a case (fetch its recent mini-trail).
  const openIncident = useCallback((caseId: string, triggeredAt?: string) => {
    setIncident(caseId); setIncidentTrail(null); setLocateMsg(null);
    setIncidentTrigger(triggeredAt ?? null); setReplayMode(false);
    fetch(`/api/track/history?caseId=${encodeURIComponent(caseId)}&limit=40`, { cache: 'no-store' })
      .then((r) => r.json()).then((d) => { if (Array.isArray(d.trail)) setIncidentTrail(d.trail); }).catch(() => {});
  }, []);

  async function locate(imei: string) {
    setLocateMsg('Envoi…');
    try {
      const res = await fetch('/api/track/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imei, action: 'locate' }) });
      setLocateMsg(res.ok ? 'Localisation demandée ✓' : 'Échec de la commande');
    } catch { setLocateMsg('Erreur réseau'); }
  }

  const openAlerts = useMemo(() => alerts.slice().sort((a, b) => b.severity - a.severity || Date.parse(a.triggered_at) - Date.parse(b.triggered_at)), [alerts]);

  // Claim ("je prends") — assigns to self + IN_PROGRESS via the existing action.
  const claim = useCallback((alertId: string) => {
    const fd = new FormData();
    fd.set('alertId', alertId);
    fd.set('userId', meId);
    import('@/app/sigep/dashboard/alerts/actions').then(({ assignAlertAction }) => {
      assignAlertAction(fd);
      // Optimistic — the stream's alert_update confirms shortly after.
      setAlerts((prev) => prev.map((x) => x.id === alertId ? { ...x, assigned_to: meId, status: 'IN_PROGRESS' } : x));
    });
  }, [meId]);

  const ack = useCallback((alertId: string) => {
    const fd = new FormData();
    fd.set('alertId', alertId);
    import('@/app/sigep/dashboard/alerts/actions').then(({ acknowledgeAlertAction }) => {
      acknowledgeAlertAction(fd);
      setAlerts((prev) => prev.map((x) => x.id === alertId ? { ...x, status: 'ACKNOWLEDGED' } : x));
    });
  }, []);

  // Keyboard triage: ↑/↓ navigate, A acquitter, P prendre, I incident, Échap désélection.
  const [selIdx, setSelIdx] = useState<number>(-1);
  const selRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (incident) return; // incident modal open — leave keys to it
      if (e.key === 'ArrowDown') { e.preventDefault(); setTab('triage'); setSelIdx((i) => Math.min(openAlerts.length - 1, i + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setTab('triage'); setSelIdx((i) => Math.max(0, i - 1)); }
      else if (e.key === 'Escape') setSelIdx(-1);
      else if (selIdx >= 0 && selIdx < openAlerts.length) {
        const a = openAlerts[selIdx];
        if (e.key === 'a' || e.key === 'A') { e.preventDefault(); if (canResolve) ack(a.id); }
        else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); if (canResolve && meId) claim(a.id); }
        else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); openIncident(a.case_id, a.triggered_at); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openAlerts, selIdx, incident, canResolve, meId, ack, claim, openIncident]);
  useEffect(() => { selRef.current?.scrollIntoView({ block: 'nearest' }); }, [selIdx]);

  // Sample metrics into the sparkline history (server refreshes them ~30 s).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKpiHist((prev) => {
      const next = { ...prev };
      const push = (k: string, v: number) => { next[k] = [...(prev[k] ?? []), v].slice(-60); };
      push('online', metrics.online); push('offline', metrics.offline);
      push('violations', metrics.violations); push('battery', metrics.battery); push('stale', metrics.stale);
      return next;
    });
  }, [metrics]);

  // Crisis mode: fullscreen lifecycle + violation auto-cycle every 10 s.
  useEffect(() => {
    function onFsChange() { if (!document.fullscreenElement) setCrisis(false); }
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!crisis) { setCycleCase(null); return; }
    const violators = () => livePos.filter((p) => p.status === 'VIOLATION').map((p) => p.case_id);
    let i = 0;
    const tick = () => {
      const v = violators();
      if (v.length === 0) { setCycleCase(null); return; }
      setCycleCase(v[i % v.length]);
      i++;
    };
    const id = setInterval(tick, 10_000);
    const first = setTimeout(tick, 300); // first focus right after entering crisis mode
    return () => { clearInterval(id); clearTimeout(first); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crisis]);

  function enterCrisis() {
    setCrisis(true);
    rootRef.current?.requestFullscreen?.().catch(() => {});
  }

  // P — major-incident detection: many simultaneous active violations.
  const violationCount = useMemo(() => openAlerts.filter((a) => ['GEOFENCE_EXIT', 'BLE_EXIT', 'CURFEW_VIOLATION', 'TAMPER_DETECTED', 'PANIC_BUTTON'].includes(a.alert_type)).length, [openAlerts]);
  const major = violationCount >= 3;
  const incidentCtx = incident ? caseInfo[incident] : null;

  // SLA tied to the REAL escalation engine: an unacknowledged alert escalates
  // to the judge after `escalateMinutes` (SMS N1), then to SUPER_ADMIN at 2 h
  // (N2, severity >= 4). Shows a live countdown until N1 fires.
  function sla(a: TriageAlert) {
    const elapsedMs = now - Date.parse(a.triggered_at);
    if (a.escalated_l2_at) return { cls: 'text-red-700', label: `${ago(a.triggered_at, now)}`, badge: 'ESCALADE N2', badgeCls: 'bg-red-700 text-white', escalate: true };
    if (a.escalated_at) return { cls: 'text-red-600', label: `${ago(a.triggered_at, now)}`, badge: 'Escaladée juge', badgeCls: 'bg-red-100 text-red-700', escalate: true };
    if (a.status === 'NEW') {
      const remainMs = escalateMinutes * 60_000 - elapsedMs;
      if (remainMs > 0) {
        const mm = Math.floor(remainMs / 60_000);
        const ss = Math.floor((remainMs % 60_000) / 1000);
        const urgent = remainMs < 5 * 60_000;
        return {
          cls: urgent ? 'text-red-600' : 'text-amber-600',
          label: `${ago(a.triggered_at, now)}`,
          badge: `Escalade ${mm}:${String(ss).padStart(2, '0')}`,
          badgeCls: urgent ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200',
          escalate: urgent,
        };
      }
      return { cls: 'text-red-600', label: `${ago(a.triggered_at, now)}`, badge: 'Escalade imminente', badgeCls: 'bg-red-100 text-red-700', escalate: true };
    }
    // Acknowledged / in progress — countdown stopped.
    const min = elapsedMs / 60_000;
    return { cls: min < 15 ? 'text-emerald-600' : 'text-amber-600', label: `${ago(a.triggered_at, now)}`, badge: null, badgeCls: '', escalate: false };
  }

  const streamView = useMemo(() => events.filter((e) => {
    if (streamFilter === 'all') return true;
    const violation = ['GEOFENCE_EXIT', 'BLE_EXIT', 'CURFEW_VIOLATION', 'TAMPER', 'TAMPER_DETECTED', 'PANIC_BUTTON'].includes(e.type);
    return streamFilter === 'violations' ? violation : !violation;
  }), [events, streamFilter]);

  const ingestionLabel = ingestionLastMs ? ago(new Date(ingestionLastMs).toISOString(), now) : '—';
  const ingestionStale = ingestionLastMs ? (now - ingestionLastMs) > 15 * 60_000 : true;

  const KPIS = [
    { key: 'online', label: 'En ligne', v: metrics.online, cls: crisis ? 'text-emerald-400' : 'text-emerald-700', spark: '#34d399' },
    { key: 'offline', label: 'Hors ligne', v: metrics.offline, cls: crisis ? 'text-slate-400' : 'text-gray-500', spark: '#94a3b8' },
    { key: 'violations', label: 'Violations', v: metrics.violations, cls: crisis ? 'text-red-400' : 'text-red-700', spark: '#f87171' },
    { key: 'battery', label: 'Batterie', v: metrics.battery, cls: crisis ? 'text-amber-400' : 'text-amber-700', spark: '#fbbf24' },
    { key: 'stale', label: 'Sans contact', v: metrics.stale, cls: crisis ? 'text-orange-400' : 'text-orange-700', spark: '#fb923c' },
    { key: '', label: 'Tps réponse', v: metrics.avgAckMin != null ? `${metrics.avgAckMin}min` : '—', cls: crisis ? 'text-blue-400' : 'text-blue-700', spark: '' },
    { key: '', label: 'Tps résolution', v: metrics.avgResolveMin != null ? `${metrics.avgResolveMin}min` : '—', cls: crisis ? 'text-violet-400' : 'text-violet-700', spark: '' },
  ];

  const card = crisis ? 'border-slate-800 bg-slate-900' : 'border-gray-100 bg-white';
  const cycled = cycleCase ? livePos.find((p) => p.case_id === cycleCase) : null;

  return (
    <div ref={rootRef} className={`space-y-3 ${crisis ? 'bg-slate-950 p-4 overflow-y-auto' : 'bg-gray-50'}`}>
      <style>{`@keyframes tickerScroll { 0% { transform: translateX(100%) } 100% { transform: translateX(-100%) } }`}</style>

      {/* Crisis ticker — scrolling banner of every open alert. */}
      {crisis && openAlerts.length > 0 && (
        <div className="relative overflow-hidden rounded-xl bg-red-950/80 border border-red-900 py-2">
          <div className="whitespace-nowrap text-red-200 text-sm font-semibold" style={{ animation: `tickerScroll ${Math.max(18, openAlerts.length * 6)}s linear infinite` }}>
            {openAlerts.map((a) => (
              <span key={a.id} className="mx-6">
                ⚠ {EVENT_LABEL[a.alert_type] ?? a.alert_type} · {a.case_number} · il y a {ago(a.triggered_at, now)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* P — major incident banner */}
      {major && (
        <div className="flex items-center gap-2 bg-red-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold animate-pulse">
          <ShieldAlert className="w-5 h-5" /> ÉTAT D&apos;ALERTE — {violationCount} violations actives simultanées
          {(metrics.stale > 0 || metrics.battery > 0) && <span className="font-normal opacity-90">· {metrics.stale} muets · {metrics.battery} batterie critique</span>}
        </div>
      )}
      {flash && !crisis && <div className="flex items-center gap-2 bg-red-600 text-white rounded-xl px-4 py-2 text-sm font-semibold animate-pulse"><Bell className="w-4 h-4" /> Nouvelle alerte reçue</div>}

      {/* J — KPI + health (sparklines = last ~30 min trend) */}
      <div className="flex flex-wrap items-stretch gap-2">
        {KPIS.map((k) => (
          <div key={k.label} className={`flex-1 min-w-[90px] rounded-xl border px-3 py-2 text-center ${card}`}>
            <p className={`${crisis ? 'text-3xl' : 'text-xl'} font-bold ${k.cls}`}>{k.v}</p>
            <p className={`text-[10px] ${crisis ? 'text-slate-400' : 'text-gray-500'}`}>{k.label}</p>
            {k.key && <Spark data={kpiHist[k.key] ?? []} color={k.spark} />}
          </div>
        ))}
        <div className={`flex flex-col justify-center gap-1 rounded-xl border px-3 py-2 ${card}`}>
          <span data-tip="Connexion au flux temps réel" className={`flex items-center gap-1 text-[11px] font-medium ${connected ? (crisis ? 'text-emerald-400' : 'text-emerald-600') : 'text-gray-400'}`}><CircleDot className="w-3 h-3" />{connected ? 'Temps réel actif' : 'Reconnexion…'}</span>
          <span data-tip="Dernière position reçue de la flotte" className={`flex items-center gap-1 text-[11px] ${ingestionStale ? 'text-red-500' : crisis ? 'text-slate-400' : 'text-gray-500'}`}><Radio className="w-3 h-3" />Ingestion : {ingestionLabel}</span>
          {crisis && cycled && (
            <span className="flex items-center gap-1 text-[11px] text-red-400 font-semibold animate-pulse">
              <Crosshair className="w-3 h-3" /> Cycle : {cycled.case_number}
            </span>
          )}
        </div>
        <button onClick={() => setMuted((m) => !m)} data-tip={muted ? 'Réactiver le son des alertes' : 'Couper le son des alertes'} className={`rounded-xl border px-3 ${card} ${crisis ? 'text-slate-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>{muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
        <button
          onClick={() => crisis ? document.exitFullscreen?.() : enterCrisis()}
          data-tip={crisis ? 'Quitter la salle de crise' : 'Mode salle de crise (plein écran, cycle violations)'}
          className={`rounded-xl border px-3 font-semibold text-xs ${crisis ? 'border-red-800 bg-red-950 text-red-300 hover:text-red-100' : `${card} text-gray-600 hover:text-gray-900`}`}
        >
          {crisis ? <span className="flex items-center gap-1.5"><X className="w-4 h-4" /> Quitter</span> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 h-[calc(100vh-15rem)]">
        {/* Map */}
        <div className="xl:col-span-3 rounded-2xl overflow-hidden border border-gray-100 min-h-[360px]">
          <LiveMapGrid initialPositions={livePos} geofences={geofences} focusCaseId={cycleCase} />
        </div>

        {/* Triage / Stream */}
        <div className={`xl:col-span-2 flex flex-col rounded-2xl border overflow-hidden min-h-[360px] ${crisis ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
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
              ) : (
                <>
                  <div className="px-3 py-1 text-[10px] text-gray-300 border-b border-gray-50 select-none">
                    Clavier : ↑↓ naviguer · A acquitter · P prendre · I incident
                  </div>
                  {openAlerts.map((a, idx) => {
                    const s = sla(a);
                    const mine = a.assigned_to === meId && meId !== '';
                    const claimedBy = a.assigned_to
                      ? (a.assigned_to === meId ? meName || 'vous' : operationals.find((u) => u.id === a.assigned_to)?.full_name ?? null)
                      : null;
                    const selected = idx === selIdx;
                    return (
                      <div
                        key={a.id}
                        ref={selected ? selRef : undefined}
                        onClick={() => setSelIdx(idx)}
                        className={`px-3 py-2.5 cursor-default ${selected ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/40' : s.escalate && a.status === 'NEW' ? 'bg-red-50/60' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <AlertTypeBadge type={a.alert_type as never} />
                            {s.badge && (
                              <span data-tip="Chaîne d'escalade réelle (SMS juge puis SUPER_ADMIN)" className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${s.badgeCls} ${s.escalate ? 'animate-pulse' : ''}`}>
                                {s.badge}
                              </span>
                            )}
                          </div>
                          <span data-tip="Temps écoulé depuis le déclenchement" className={`flex items-center gap-1 text-[11px] font-semibold flex-shrink-0 ${s.cls}`}><Clock className="w-3 h-3" />{s.label}</span>
                        </div>
                        {a.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.description}</p>}
                        {claimedBy && (
                          <p className={`text-[11px] mt-0.5 font-medium ${mine ? 'text-blue-700' : 'text-gray-500'}`}>
                            ⛨ {mine ? 'Vous traitez cette alerte' : `${claimedBy} traite cette alerte`}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2 mt-1.5">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openIncident(a.case_id, a.triggered_at)} data-tip="Ouvrir la fiche incident (carte + rejeu + commandes)" className="inline-flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-900"><Crosshair className="w-3.5 h-3.5" /> Incident</button>
                            <Link href={`/sigep/dashboard/cases/${a.case_id}`} className="text-[11px] text-blue-600 hover:underline font-mono">{a.case_number}</Link>
                            {canResolve && meId && !a.assigned_to && (
                              <button onClick={() => claim(a.id)} data-tip="Prendre en charge (assignation + verrou visible par tous)" className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800">
                                ⛨ Prendre
                              </button>
                            )}
                          </div>
                          {canResolve && <AlertActions alertId={a.id} status={a.status} assignedTo={a.assigned_to} users={operationals} />}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
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

      {/* M — incident panel */}
      {incident && incidentCtx && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4" onClick={() => setIncident(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <h3 className="font-semibold text-gray-900">{incidentCtx.label}</h3>
                {incidentCtx.risk && <RiskBadge level={incidentCtx.risk as RiskLevel} />}
              </div>
              <div className="flex items-center gap-2">
                {incidentTrigger && (
                  <button onClick={() => setReplayMode((v) => !v)} data-tip="Rejouer la séquence (±30 min autour du déclenchement)" className={`text-xs px-2 py-1 rounded-lg font-medium ${replayMode ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                    {replayMode ? '🗺️ Carte live' : '⏵ Rejeu incident'}
                  </button>
                )}
                <button onClick={() => setIncident(null)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="h-[320px]">
              {replayMode && incidentTrigger ? (
                <IncidentReplay caseId={incident} triggeredAt={incidentTrigger} />
              ) : incidentCtx.lat != null && incidentCtx.lng != null ? (
                <TrackingMap
                  markers={[{ id: incident, caseId: incident, caseRef: '', label: incidentCtx.label, lat: incidentCtx.lat, lng: incidentCtx.lng, status: 'alert', lastUpdate: '' } as TrackerMarker]}
                  focus={[incidentCtx.lat, incidentCtx.lng]}
                  extraTrail={incidentTrail}
                  zoom={16}
                />
              ) : <div className="h-full flex items-center justify-center text-sm text-gray-400">Aucune position connue.</div>}
            </div>
            <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
              {incidentCtx.imei && (
                <button onClick={() => locate(incidentCtx.imei!)} data-tip="Demander une localisation GPS immédiate" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500"><MapPin className="w-3.5 h-3.5" /> Localiser</button>
              )}
              {incidentCtx.sim && (
                <a href={`tel:${incidentCtx.sim}`} data-tip="Appeler le bracelet (voix bidirectionnelle)" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500"><Phone className="w-3.5 h-3.5" /> Appeler</a>
              )}
              <Link href={`/sigep/dashboard/cases/${incident}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold">Dossier ↗</Link>
              <a href={`https://www.google.com/maps?q=${incidentCtx.lat},${incidentCtx.lng}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold">Google Maps</a>
              {locateMsg && <span className="text-xs text-gray-500">{locateMsg}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
