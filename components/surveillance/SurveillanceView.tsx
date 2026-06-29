'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Search, Wifi, WifiOff, AlertTriangle, Battery, Crosshair, Maximize2, Download, CircleDot } from 'lucide-react';
import type { TrackerMarker, MapGeofence } from '@/components/map/TrackingMap';

const TrackingMap = dynamic(() => import('@/components/map/TrackingMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

type Filter = 'all' | 'active' | 'alert' | 'offline' | 'battery' | 'stale';
type Sort = 'priority' | 'battery' | 'recent' | 'name';

const DOT: Record<TrackerMarker['status'], string> = { active: 'bg-emerald-500', alert: 'bg-red-500', offline: 'bg-gray-300' };
const STATUS_LABEL: Record<TrackerMarker['status'], string> = { active: 'Surveillance active', alert: 'Violation de périmètre', offline: 'Hors ligne' };

const STALE_MS = 15 * 60_000;
const FRESH_MS = 2 * 60_000;

function freshness(lastSeenMs: number | null | undefined, now: number) {
  if (!now || !lastSeenMs) return { cls: 'bg-gray-300', label: '—' };
  const age = now - lastSeenMs;
  const mins = Math.floor(age / 60_000);
  const label = age < 60_000 ? "à l'instant" : mins < 60 ? `il y a ${mins} min` : `il y a ${Math.floor(mins / 60)} h`;
  if (age < FRESH_MS) return { cls: 'bg-emerald-500', label };
  if (age < STALE_MS) return { cls: 'bg-amber-500', label };
  return { cls: 'bg-red-500', label };
}

export default function SurveillanceView({ initialMarkers, geofences = [] }: { initialMarkers: TrackerMarker[]; geofences?: MapGeofence[] }) {
  const [markers, setMarkers] = useState<TrackerMarker[]>(initialMarkers);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('priority');
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(0); // set on mount to avoid SSR hydration mismatch
  const [connected, setConnected] = useState(false);
  const [trail, setTrail] = useState<[number, number][] | null>(null);
  const mapBox = useRef<HTMLDivElement>(null);

  // Restore persisted preferences.
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem('horon.surv.prefs') ?? '{}');
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (p.filter) setFilter(p.filter);
      if (p.sort) setSort(p.sort);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem('horon.surv.prefs', JSON.stringify({ filter, sort })); } catch { /* ignore */ }
  }, [filter, sort]);

  // Ticking clock for freshness labels (set immediately on mount).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Live position feed + connection status (Supabase Realtime).
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import('@/lib/supabase/client').then(({ createClient, IS_DEMO_MODE }) => {
      if (IS_DEMO_MODE) { setConnected(true); return; }
      const supabase = createClient();
      if (!supabase) return;
      const stale = supabase.getChannels().find((c) => c.topic === 'realtime:surveillance-live');
      if (stale) supabase.removeChannel(stale);
      const channel = supabase
        .channel('surveillance-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'positions' }, (payload) => {
          const row = payload.new as { case_id: string; latitude: number; longitude: number; speed_kmh: number | null; recorded_at: string };
          setMarkers((prev) => prev.map((m) => m.caseId === row.case_id
            ? { ...m, lat: row.latitude, lng: row.longitude, speedKmh: row.speed_kmh ?? m.speedKmh, online: true, lastSeenMs: Date.parse(row.recorded_at), lastUpdate: new Date(row.recorded_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
            : m));
        })
        .subscribe((status) => setConnected(status === 'SUBSCRIBED'));
      cleanup = () => { supabase.removeChannel(channel); };
    });
    return () => { cleanup?.(); };
  }, []);

  const isStale = useCallback((m: TrackerMarker) => m.lastSeenMs != null && now - m.lastSeenMs >= STALE_MS, [now]);

  const counts = useMemo(() => ({
    all: markers.length,
    active: markers.filter((m) => m.status === 'active').length,
    alert: markers.filter((m) => m.status === 'alert').length,
    offline: markers.filter((m) => m.status === 'offline').length,
    battery: markers.filter((m) => m.battery != null && m.battery < 20).length,
    stale: markers.filter((m) => isStale(m)).length,
  }), [markers, isStale]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = markers.filter((m) => {
      if (filter === 'battery') return m.battery != null && m.battery < 20;
      if (filter === 'stale') return isStale(m);
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

  function focusOn(m: TrackerMarker) {
    setSelected(m.caseId);
    setFocus([m.lat, m.lng]);
    setTrail(null);
    // mini-trail: last ~40 points for the selected device
    fetch(`/api/track/history?caseId=${encodeURIComponent(m.caseId)}&limit=40`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.trail)) setTrail(d.trail); })
      .catch(() => {});
  }

  function exportSnapshot() {
    const header = ['Porteur', 'Dossier', 'Statut', 'Latitude', 'Longitude', 'Batterie', 'Dernier contact'];
    const rows = list.map((m) => [m.label, m.caseRef, STATUS_LABEL[m.status], m.lat, m.lng, m.battery ?? '', m.lastUpdate]);
    const csv = '﻿' + [header, ...rows].map((r) => r.map((v) => /[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `surveillance_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const KPIS: { key: Filter; label: string; n: number; cls: string }[] = [
    { key: 'all', label: 'Total', n: counts.all, cls: 'text-gray-700' },
    { key: 'active', label: 'Actifs', n: counts.active, cls: 'text-emerald-700' },
    { key: 'alert', label: 'Violations', n: counts.alert, cls: 'text-red-700' },
    { key: 'battery', label: 'Batterie faible', n: counts.battery, cls: 'text-amber-700' },
    { key: 'stale', label: 'Sans contact', n: counts.stale, cls: 'text-orange-700' },
    { key: 'offline', label: 'Hors ligne', n: counts.offline, cls: 'text-gray-500' },
  ];

  return (
    <div className="space-y-3">
      {/* KPI bar — clickable filters */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {KPIS.map((k) => (
          <button
            key={k.key}
            onClick={() => setFilter(k.key)}
            data-tip={`Filtrer : ${k.label.toLowerCase()}`}
            className={`rounded-xl border px-3 py-2 text-center transition ${filter === k.key ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white hover:bg-gray-50'}`}
          >
            <p className={`text-xl font-bold ${k.cls}`}>{k.n}</p>
            <p className="text-[10px] text-gray-500">{k.label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 h-[calc(100vh-13rem)]">
        {/* Map */}
        <div ref={mapBox} className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm min-h-[360px] bg-gray-900">
          <TrackingMap
            markers={markers}
            geofences={geofences}
            focus={focus}
            selectedId={selected}
            onMarkerClick={(caseId) => setSelected(caseId)}
            extraTrail={trail}
          />
          {/* Map overlay controls */}
          <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
            <span data-tip={connected ? 'Flux temps réel connecté' : 'Temps réel déconnecté'} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium shadow ${connected ? 'bg-white text-emerald-600' : 'bg-white text-gray-400'}`}>
              <CircleDot className={`w-3 h-3 ${connected ? 'text-emerald-500' : 'text-gray-300'}`} /> {connected ? 'Live' : 'Hors-ligne'}
            </span>
            <button onClick={() => mapBox.current?.requestFullscreen?.()} data-tip="Mode mur de supervision (plein écran)" className="p-1.5 rounded-lg bg-white shadow text-gray-600 hover:text-gray-900">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live panel */}
        <div className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[360px]">
          <div className="p-3 border-b border-gray-50 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un porteur ou un dossier…" className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} data-tip="Trier la liste" className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
                <option value="priority">Tri : priorité</option>
                <option value="battery">Tri : batterie</option>
                <option value="recent">Tri : contact récent</option>
                <option value="name">Tri : nom</option>
              </select>
              <button onClick={exportSnapshot} data-tip="Exporter la liste visible en CSV" className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-2 py-1.5">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {list.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">Aucun bracelet ne correspond.</p>
            ) : list.map((m) => {
              const fr = freshness(m.lastSeenMs, now);
              return (
                <button key={m.caseId} onClick={() => focusOn(m)} data-tip="Centrer la carte + afficher le mini-trajet" className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition ${selected === m.caseId ? 'bg-emerald-50' : ''}`}>
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT[m.status]} ${m.status === 'alert' ? 'animate-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.label}</p>
                    <p className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${fr.cls}`} /> {fr.label} · {m.caseRef}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span>{m.online ? <Wifi className="w-3.5 h-3.5 text-emerald-500" /> : <WifiOff className="w-3.5 h-3.5 text-gray-300" />}</span>
                    {m.battery != null && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${m.battery < 20 ? 'text-red-500' : 'text-gray-400'}`}><Battery className="w-3 h-3" />{m.battery}%</span>
                    )}
                  </div>
                  <Crosshair className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                </button>
              );
            })}
          </div>

          <div className="p-2.5 border-t border-gray-50 flex items-center justify-around text-xs">
            <span className="flex items-center gap-1 text-emerald-600"><Wifi className="w-3.5 h-3.5" />{counts.active}</span>
            <span className="flex items-center gap-1 text-red-600"><AlertTriangle className="w-3.5 h-3.5" />{counts.alert}</span>
            <span className="flex items-center gap-1 text-orange-600"><CircleDot className="w-3.5 h-3.5" />{counts.stale} muets</span>
            <span className="flex items-center gap-1 text-gray-400"><WifiOff className="w-3.5 h-3.5" />{counts.offline}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
