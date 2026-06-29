'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Search, Wifi, WifiOff, AlertTriangle, Battery, Maximize2, Download, CircleDot, Moon, Sun, Tag, MapPin, ExternalLink, Home, Gauge, Clock } from 'lucide-react';
import type { TrackerMarker, MapGeofence } from '@/components/map/TrackingMap';
import { RiskBadge } from '@/components/ui/StatusBadge';
import AlertActions from '@/components/alerts/AlertActions';
import { useAlertFeed } from '@/hooks/useAlertFeed';
import type { RiskLevel } from '@/lib/supabase/types';

const TrackingMap = dynamic(() => import('@/components/map/TrackingMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-900 flex items-center justify-center"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>,
});

interface AlertInfo { id: string; alert_type: string; status: string; assigned_to: string | null; severity: number; description: string | null }
type Filter = 'all' | 'active' | 'alert' | 'offline' | 'battery' | 'stale' | 'high';
type Sort = 'priority' | 'battery' | 'recent' | 'name';

const DOT: Record<TrackerMarker['status'], string> = { active: 'bg-emerald-500', alert: 'bg-red-500', offline: 'bg-gray-300' };
const STATUS_LABEL: Record<TrackerMarker['status'], string> = { active: 'Surveillance active', alert: 'Violation de périmètre', offline: 'Hors ligne' };
const STALE_MS = 15 * 60_000, FRESH_MS = 2 * 60_000;

function freshness(lastSeenMs: number | null | undefined, now: number) {
  if (!now || !lastSeenMs) return { cls: 'bg-gray-300', label: '—' };
  const age = now - lastSeenMs, mins = Math.floor(age / 60_000);
  const label = age < 60_000 ? "à l'instant" : mins < 60 ? `il y a ${mins} min` : `il y a ${Math.floor(mins / 60)} h`;
  if (age < FRESH_MS) return { cls: 'bg-emerald-500', label };
  if (age < STALE_MS) return { cls: 'bg-amber-500', label };
  return { cls: 'bg-red-500', label };
}

export default function SurveillanceView({
  initialMarkers, geofences = [], openAlerts = {}, operationals = [], canResolve = false,
}: {
  initialMarkers: TrackerMarker[];
  geofences?: MapGeofence[];
  openAlerts?: Record<string, AlertInfo>;
  operationals?: { id: string; full_name: string }[];
  canResolve?: boolean;
}) {
  const [markers, setMarkers] = useState<TrackerMarker[]>(initialMarkers);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('priority');
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(0);
  const [connected, setConnected] = useState(false);
  const [trail, setTrail] = useState<[number, number][] | null>(null);
  const [night, setNight] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [address, setAddress] = useState<string | null>(null);
  const [presence, setPresence] = useState<{ atHome: boolean } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const mapBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const p = JSON.parse(localStorage.getItem('horon.surv.prefs') ?? '{}');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (p.filter) setFilter(p.filter);
      if (p.sort) setSort(p.sort);
      if (p.night) setNight(true);
      if (p.labels) setShowLabels(true);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { localStorage.setItem('horon.surv.prefs', JSON.stringify({ filter, sort, night, labels: showLabels })); } catch { /* ignore */ } }, [filter, sort, night, showLabels]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Live positions + connection status.
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import('@/lib/supabase/client').then(({ createClient, IS_DEMO_MODE }) => {
      if (IS_DEMO_MODE) { setConnected(true); return; }
      const supabase = createClient();
      if (!supabase) return;
      const stale = supabase.getChannels().find((c) => c.topic === 'realtime:surveillance-live');
      if (stale) supabase.removeChannel(stale);
      const channel = supabase.channel('surveillance-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'positions' }, (payload) => {
          const r = payload.new as { case_id: string; latitude: number; longitude: number; speed_kmh: number | null; recorded_at: string };
          setMarkers((prev) => prev.map((m) => m.caseId === r.case_id ? { ...m, lat: r.latitude, lng: r.longitude, speedKmh: r.speed_kmh ?? m.speedKmh, online: true, lastSeenMs: Date.parse(r.recorded_at), lastUpdate: new Date(r.recorded_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) } : m));
        })
        .subscribe((s) => setConnected(s === 'SUBSCRIBED'));
      cleanup = () => { supabase.removeChannel(channel); };
    });
    return () => { cleanup?.(); };
  }, []);

  // E — react to a new violation: focus the map + flash banner (sound is global).
  useAlertFeed(useCallback((alert) => {
    if (!['GEOFENCE_EXIT', 'CURFEW_VIOLATION', 'TAMPER_DETECTED', 'PANIC_BUTTON'].includes(alert.alert_type)) return;
    setMarkers((prev) => prev.map((m) => m.caseId === alert.case_id ? { ...m, status: 'alert' } : m));
    const m = markers.find((x) => x.caseId === alert.case_id);
    if (m) { setSelected(m.caseId); setFocus([m.lat, m.lng]); }
    setFlash(`Nouvelle violation — ${m?.label ?? alert.case_id.slice(0, 8)}`);
    setTimeout(() => setFlash(null), 6000);
  }, [markers]));

  const isStale = useCallback((m: TrackerMarker) => m.lastSeenMs != null && now - m.lastSeenMs >= STALE_MS, [now]);

  const counts = useMemo(() => ({
    all: markers.length,
    active: markers.filter((m) => m.status === 'active').length,
    alert: markers.filter((m) => m.status === 'alert').length,
    offline: markers.filter((m) => m.status === 'offline').length,
    battery: markers.filter((m) => m.battery != null && m.battery < 20).length,
    stale: markers.filter((m) => isStale(m)).length,
    high: markers.filter((m) => m.riskLevel === 'HIGH').length,
  }), [markers, isStale]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = markers.filter((m) => {
      if (filter === 'battery') return m.battery != null && m.battery < 20;
      if (filter === 'stale') return isStale(m);
      if (filter === 'high') return m.riskLevel === 'HIGH';
      if (filter !== 'all') return m.status === filter;
      return true;
    }).filter((m) => !q || m.label.toLowerCase().includes(q) || m.caseRef.toLowerCase().includes(q));
    const score = (m: TrackerMarker) => (m.status === 'alert' ? 0 : 1) + (isStale(m) ? 0 : 0.5);
    return filtered.sort((a, b) => {
      if (sort === 'priority') return score(a) - score(b);
      if (sort === 'battery') return (a.battery ?? 999) - (b.battery ?? 999);
      if (sort === 'recent') return (b.lastSeenMs ?? 0) - (a.lastSeenMs ?? 0);
      return a.label.localeCompare(b.label);
    });
  }, [markers, filter, query, sort, isStale]);

  const selectedMarker = useMemo(() => markers.find((m) => m.caseId === selected) ?? null, [markers, selected]);

  // F — load address + home presence for the selected device.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAddress(null); setPresence(null);
    if (!selectedMarker) return;
    const ac = new AbortController();
    fetch(`/api/geo/reverse?lat=${selectedMarker.lat}&lng=${selectedMarker.lng}`, { signal: ac.signal })
      .then((r) => r.json()).then((d) => setAddress(d.address ?? null)).catch(() => {});
    if (selectedMarker.imei) {
      fetch(`/api/track/presence?imei=${encodeURIComponent(selectedMarker.imei)}`, { signal: ac.signal })
        .then((r) => r.json()).then((d) => setPresence(d.configured ? { atHome: !!d.atHome } : null)).catch(() => {});
    }
    return () => ac.abort();
  }, [selectedMarker]);

  const focusOn = useCallback((m: TrackerMarker) => {
    setSelected(m.caseId); setFocus([m.lat, m.lng]); setTrail(null);
    fetch(`/api/track/history?caseId=${encodeURIComponent(m.caseId)}&limit=40`, { cache: 'no-store' })
      .then((r) => r.json()).then((d) => { if (Array.isArray(d.trail)) setTrail(d.trail); }).catch(() => {});
  }, []);

  // G — keyboard navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') { setSelected(null); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'f') return;
      e.preventDefault();
      const idx = list.findIndex((m) => m.caseId === selected);
      if (e.key === 'f' && selectedMarker) { setFocus([selectedMarker.lat, selectedMarker.lng]); return; }
      const next = e.key === 'ArrowDown' ? Math.min(list.length - 1, idx + 1) : Math.max(0, idx - 1);
      if (list[next]) focusOn(list[next]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list, selected, selectedMarker, focusOn]);

  function exportRows(rows: TrackerMarker[]) {
    const header = ['Porteur', 'Dossier', 'Statut', 'Risque', 'Latitude', 'Longitude', 'Batterie', 'Dernier contact'];
    const data = rows.map((m) => [m.label, m.caseRef, STATUS_LABEL[m.status], m.riskLevel ?? '', m.lat, m.lng, m.battery ?? '', m.lastUpdate]);
    const csv = '﻿' + [header, ...data].map((r) => r.map((v) => /[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `surveillance_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }
  const exportSel = () => exportRows(checked.size ? list.filter((m) => checked.has(m.caseId)) : list);
  const toggleCheck = (id: string) => setChecked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const KPIS: { key: Filter; label: string; n: number; cls: string }[] = [
    { key: 'all', label: 'Total', n: counts.all, cls: 'text-gray-700' },
    { key: 'active', label: 'Actifs', n: counts.active, cls: 'text-emerald-700' },
    { key: 'alert', label: 'Violations', n: counts.alert, cls: 'text-red-700' },
    { key: 'high', label: 'Risque élevé', n: counts.high, cls: 'text-red-700' },
    { key: 'battery', label: 'Batterie', n: counts.battery, cls: 'text-amber-700' },
    { key: 'stale', label: 'Sans contact', n: counts.stale, cls: 'text-orange-700' },
  ];

  const panelBg = night ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-100';
  const rowHover = night ? 'hover:bg-gray-800' : 'hover:bg-gray-50';

  return (
    <div className="space-y-3">
      {flash && (
        <div className="flex items-center gap-2 bg-red-600 text-white rounded-xl px-4 py-2 text-sm font-semibold animate-pulse">
          <AlertTriangle className="w-4 h-4" /> {flash}
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {KPIS.map((k) => (
          <button key={k.key} onClick={() => setFilter(k.key)} data-tip={`Filtrer : ${k.label.toLowerCase()}`}
            className={`rounded-xl border px-3 py-2 text-center transition ${filter === k.key ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white hover:bg-gray-50'}`}>
            <p className={`text-xl font-bold ${k.cls}`}>{k.n}</p>
            <p className="text-[10px] text-gray-500">{k.label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 h-[calc(100vh-13rem)]">
        {/* Map */}
        <div ref={mapBox} className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm min-h-[360px] bg-gray-900">
          <TrackingMap markers={markers} geofences={geofences} focus={focus} selectedId={selected} onMarkerClick={(id) => focusOn(markers.find((m) => m.caseId === id) ?? { caseId: id } as TrackerMarker)} extraTrail={trail} showLabels={showLabels} />
          <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
            <span data-tip={connected ? 'Flux temps réel connecté' : 'Temps réel déconnecté'} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium shadow bg-white ${connected ? 'text-emerald-600' : 'text-gray-400'}`}>
              <CircleDot className={`w-3 h-3 ${connected ? 'text-emerald-500' : 'text-gray-300'}`} /> {connected ? 'Live' : 'Hors-ligne'}
            </span>
            <button onClick={() => setShowLabels((v) => !v)} data-tip="Afficher/masquer les noms sur les marqueurs" className={`p-1.5 rounded-lg shadow ${showLabels ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}><Tag className="w-4 h-4" /></button>
            <button onClick={() => setNight((v) => !v)} data-tip="Mode nuit (salle de contrôle)" className="p-1.5 rounded-lg bg-white shadow text-gray-600 hover:text-gray-900">{night ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
            <button onClick={() => mapBox.current?.requestFullscreen?.()} data-tip="Mode mur de supervision (plein écran)" className="p-1.5 rounded-lg bg-white shadow text-gray-600 hover:text-gray-900"><Maximize2 className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Panel */}
        <div className={`flex flex-col rounded-2xl border shadow-sm overflow-hidden min-h-[360px] ${panelBg}`}>
          <div className={`p-3 border-b ${night ? 'border-gray-700' : 'border-gray-50'} space-y-2`}>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" className={`w-full pl-8 pr-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${night ? 'bg-gray-800 border border-gray-700 text-gray-100' : 'border border-gray-200'}`} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} data-tip="Trier la liste" className={`text-xs rounded-lg px-2 py-1.5 ${night ? 'bg-gray-800 border border-gray-700' : 'border border-gray-200'}`}>
                <option value="priority">Tri : priorité</option><option value="battery">Tri : batterie</option><option value="recent">Tri : récent</option><option value="name">Tri : nom</option>
              </select>
              <button onClick={exportSel} data-tip="Exporter la sélection (ou toute la liste visible) en CSV" className={`inline-flex items-center gap-1 text-xs rounded-lg px-2 py-1.5 ${night ? 'border border-gray-700 text-gray-200' : 'border border-gray-200 text-gray-600'}`}>
                <Download className="w-3.5 h-3.5" /> Export {checked.size ? `(${checked.size})` : ''}
              </button>
            </div>
          </div>

          {/* Mini-fiche du device sélectionné */}
          {selectedMarker && (
            <div className={`p-3 border-b text-sm ${night ? 'border-gray-700 bg-gray-800' : 'border-gray-50 bg-gray-50'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold truncate">{selectedMarker.label}</p>
                <RiskBadge level={(selectedMarker.riskLevel ?? 'MEDIUM') as RiskLevel} />
              </div>
              <p className="text-[11px] text-gray-400 mb-2">{selectedMarker.caseRef} · {STATUS_LABEL[selectedMarker.status]}</p>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <span className="flex items-center gap-1"><Battery className="w-3.5 h-3.5 text-gray-400" />{selectedMarker.battery ?? '—'}%</span>
                <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5 text-gray-400" />{selectedMarker.speedKmh != null ? `${selectedMarker.speedKmh.toFixed(0)} km/h` : '—'}</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-400" />{freshness(selectedMarker.lastSeenMs, now).label}</span>
                {selectedMarker.curfew && <span className={`flex items-center gap-1 ${selectedMarker.curfew === 'out' ? 'text-red-500' : 'text-emerald-500'}`}>🌙 {selectedMarker.curfew === 'out' ? 'hors zone' : 'dans zone'}</span>}
                {presence && <span className="flex items-center gap-1"><Home className="w-3.5 h-3.5 text-gray-400" />{presence.atHome ? 'À domicile' : 'Absent'}</span>}
              </div>
              {address && <p className="flex items-start gap-1 text-[11px] text-gray-500 mt-1.5"><MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />{address}</p>}
              <div className="flex items-center gap-3 mt-2">
                <Link href={`/sigep/dashboard/cases/${selectedMarker.caseId}`} data-tip="Ouvrir le dossier" className="text-xs text-blue-600 hover:underline">Dossier ↗</Link>
                <a href={`https://www.google.com/maps?q=${selectedMarker.lat},${selectedMarker.lng}`} target="_blank" rel="noopener noreferrer" data-tip="Ouvrir dans Google Maps (itinéraire routier)" className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:underline"><ExternalLink className="w-3 h-3" /> Google Maps</a>
              </div>
              {/* E — open alert: acknowledge / resolve from here */}
              {canResolve && openAlerts[selectedMarker.caseId] && (
                <div className={`mt-2 pt-2 border-t ${night ? 'border-gray-700' : 'border-gray-100'}`}>
                  <p className="text-[11px] text-red-500 mb-1">Alerte ouverte : {openAlerts[selectedMarker.caseId].alert_type}</p>
                  <AlertActions alertId={openAlerts[selectedMarker.caseId].id} status={openAlerts[selectedMarker.caseId].status} assignedTo={openAlerts[selectedMarker.caseId].assigned_to} users={operationals} />
                </div>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {list.length === 0 ? <p className="p-6 text-center text-sm text-gray-400">Aucun bracelet.</p> : list.map((m) => {
              const fr = freshness(m.lastSeenMs, now);
              return (
                <div key={m.caseId} className={`px-3 py-2.5 flex items-center gap-2.5 border-b ${night ? 'border-gray-800' : 'border-gray-50'} ${selected === m.caseId ? (night ? 'bg-gray-800' : 'bg-emerald-50') : ''} ${rowHover}`}>
                  <input type="checkbox" checked={checked.has(m.caseId)} onChange={() => toggleCheck(m.caseId)} data-tip="Sélectionner pour export groupé" className="flex-shrink-0" onClick={(e) => e.stopPropagation()} />
                  <button onClick={() => focusOn(m)} data-tip="Centrer + mini-trajet" className="flex-1 min-w-0 flex items-center gap-2.5 text-left">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT[m.status]} ${m.status === 'alert' ? 'animate-pulse' : ''}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{m.label}{m.riskLevel === 'HIGH' && <span className="ml-1 text-[9px] font-bold text-red-500">●</span>}</span>
                      <span className="block text-[11px] text-gray-400 truncate"><span className={`inline-block w-1.5 h-1.5 rounded-full ${fr.cls} mr-1`} />{fr.label} · {m.caseRef}</span>
                    </span>
                    <span className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      {m.online ? <Wifi className="w-3.5 h-3.5 text-emerald-500" /> : <WifiOff className="w-3.5 h-3.5 text-gray-300" />}
                      {m.battery != null && <span className={`text-[10px] ${m.battery < 20 ? 'text-red-500' : 'text-gray-400'}`}>{m.battery}%</span>}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
