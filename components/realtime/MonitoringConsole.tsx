'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Activity, AlertTriangle, Bell, CircleDot, Maximize2, Clock, Radio, ListFilter, Volume2, VolumeX, Crosshair, Phone, X, MapPin, ShieldAlert } from 'lucide-react';
import { AlertTypeBadge, RiskBadge } from '@/components/ui/StatusBadge';
import AlertActions from '@/components/alerts/AlertActions';
import { useAlertFeed } from '@/hooks/useAlertFeed';
import type { LivePosition } from '@/hooks/usePositionFeed';
import type { TrackerMarker } from '@/components/map/TrackingMap';
import type { RiskLevel } from '@/lib/supabase/types';

const LiveMapGrid = dynamic(() => import('@/components/realtime/LiveMapGrid'), { ssr: false });
const TrackingMap = dynamic(() => import('@/components/map/TrackingMap'), { ssr: false });

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
  initialPositions, initialAlerts, initialEvents, operationals, metrics, ingestionLastMs, canResolve, caseInfo = {},
}: {
  initialPositions: LivePosition[];
  initialAlerts: TriageAlert[];
  initialEvents: StreamEvent[];
  operationals: { id: string; full_name: string }[];
  metrics: Metrics;
  ingestionLastMs: number | null;
  canResolve: boolean;
  caseInfo?: Record<string, CaseCtx>;
}) {
  const [tab, setTab] = useState<'triage' | 'stream'>('triage');
  const [alerts, setAlerts] = useState<TriageAlert[]>(initialAlerts);
  const [events, setEvents] = useState<StreamEvent[]>(initialEvents);
  const [now, setNow] = useState(0);
  const [connected, setConnected] = useState(false);
  const [streamFilter, setStreamFilter] = useState<'all' | 'violations' | 'technical'>('all');
  const [flash, setFlash] = useState(false);
  const [muted, setMuted] = useState(false);
  const [incident, setIncident] = useState<string | null>(null); // case_id
  const [incidentTrail, setIncidentTrail] = useState<[number, number][] | null>(null);
  const [locateMsg, setLocateMsg] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const mutedRef = useRef(false);

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
    beep(a.severity, mutedRef.current); // L
  }, [caseRefByCase]));

  // M — open the incident panel for a case (fetch its recent mini-trail).
  const openIncident = useCallback((caseId: string) => {
    setIncident(caseId); setIncidentTrail(null); setLocateMsg(null);
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

  // P — major-incident detection: many simultaneous active violations.
  const violationCount = useMemo(() => openAlerts.filter((a) => ['GEOFENCE_EXIT', 'CURFEW_VIOLATION', 'TAMPER_DETECTED', 'PANIC_BUTTON'].includes(a.alert_type)).length, [openAlerts]);
  const major = violationCount >= 3;
  const incidentCtx = incident ? caseInfo[incident] : null;

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
      {/* P — major incident banner */}
      {major && (
        <div className="flex items-center gap-2 bg-red-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold animate-pulse">
          <ShieldAlert className="w-5 h-5" /> ÉTAT D&apos;ALERTE — {violationCount} violations actives simultanées
          {(metrics.stale > 0 || metrics.battery > 0) && <span className="font-normal opacity-90">· {metrics.stale} muets · {metrics.battery} batterie critique</span>}
        </div>
      )}
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
        <button onClick={() => setMuted((m) => !m)} data-tip={muted ? 'Réactiver le son des alertes' : 'Couper le son des alertes'} className="rounded-xl border border-gray-100 bg-white px-3 text-gray-600 hover:text-gray-900">{muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
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
                      <div className="flex items-center gap-2">
                        <button onClick={() => openIncident(a.case_id)} data-tip="Ouvrir la fiche incident (carte + trajet + commandes)" className="inline-flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-900"><Crosshair className="w-3.5 h-3.5" /> Incident</button>
                        <Link href={`/sigep/dashboard/cases/${a.case_id}`} className="text-[11px] text-blue-600 hover:underline font-mono">{a.case_number}</Link>
                      </div>
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
              <button onClick={() => setIncident(null)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="h-[300px]">
              {incidentCtx.lat != null && incidentCtx.lng != null ? (
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
