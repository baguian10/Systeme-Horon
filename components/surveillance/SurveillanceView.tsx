'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Search, Wifi, WifiOff, AlertTriangle, Battery, Crosshair } from 'lucide-react';
import type { TrackerMarker } from '@/components/map/TrackingMap';

const TrackingMap = dynamic(() => import('@/components/map/TrackingMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

type Filter = 'all' | 'active' | 'alert' | 'offline';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'active', label: 'Actifs' },
  { key: 'alert', label: 'Violations' },
  { key: 'offline', label: 'Hors ligne' },
];

const DOT: Record<TrackerMarker['status'], string> = { active: 'bg-emerald-500', alert: 'bg-red-500', offline: 'bg-gray-300' };
const STATUS_LABEL: Record<TrackerMarker['status'], string> = { active: 'Surveillance active', alert: 'Violation de périmètre', offline: 'Hors ligne' };

export default function SurveillanceView({ initialMarkers }: { initialMarkers: TrackerMarker[] }) {
  const [markers, setMarkers] = useState<TrackerMarker[]>(initialMarkers);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const focusSeq = useRef(0);

  // Live: patch marker positions on new GPS rows (Supabase Realtime).
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import('@/lib/supabase/client').then(({ createClient, IS_DEMO_MODE }) => {
      if (IS_DEMO_MODE) return;
      const supabase = createClient();
      if (!supabase) return;
      const stale = supabase.getChannels().find((c) => c.topic === 'realtime:surveillance-live');
      if (stale) supabase.removeChannel(stale);
      const channel = supabase
        .channel('surveillance-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'positions' }, (payload) => {
          const row = payload.new as { case_id: string; latitude: number; longitude: number; speed_kmh: number | null; recorded_at: string };
          setMarkers((prev) => prev.map((m) => m.caseId === row.case_id
            ? { ...m, lat: row.latitude, lng: row.longitude, speedKmh: row.speed_kmh ?? m.speedKmh, online: true, lastUpdate: new Date(row.recorded_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
            : m));
        })
        .subscribe();
      cleanup = () => { supabase.removeChannel(channel); };
    });
    return () => { cleanup?.(); };
  }, []);

  const counts = useMemo(() => ({
    all: markers.length,
    active: markers.filter((m) => m.status === 'active').length,
    alert: markers.filter((m) => m.status === 'alert').length,
    offline: markers.filter((m) => m.status === 'offline').length,
  }), [markers]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return markers
      .filter((m) => filter === 'all' || m.status === filter)
      .filter((m) => !q || m.label.toLowerCase().includes(q) || m.caseRef.toLowerCase().includes(q))
      .sort((a, b) => (a.status === 'alert' ? -1 : 0) - (b.status === 'alert' ? -1 : 0));
  }, [markers, filter, query]);

  function focusOn(m: TrackerMarker) {
    setSelected(m.caseId);
    focusSeq.current += 1;
    // new array identity each click so the map re-flies even to the same target
    setFocus([m.lat, m.lng]);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 h-[calc(100vh-9rem)]">
      {/* Map */}
      <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm min-h-[360px]">
        <TrackingMap
          markers={markers}
          focus={focus}
          selectedId={selected}
          onMarkerClick={(caseId) => setSelected(caseId)}
        />
      </div>

      {/* Live panel */}
      <div className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[360px]">
        {/* Search */}
        <div className="p-3 border-b border-gray-50">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un porteur ou un dossier…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                data-tip={`Filtrer : ${f.label.toLowerCase()}`}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${filter === f.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {f.label} <span className="opacity-60">{counts[f.key]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {list.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">Aucun bracelet ne correspond.</p>
          ) : list.map((m) => (
            <button
              key={m.caseId}
              onClick={() => focusOn(m)}
              data-tip="Centrer la carte sur ce bracelet"
              className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition ${selected === m.caseId ? 'bg-emerald-50' : ''}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT[m.status]} ${m.status === 'alert' ? 'animate-pulse' : ''}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{m.label}</p>
                <p className="text-[11px] text-gray-400 truncate">{m.caseRef} · {STATUS_LABEL[m.status]}</p>
              </div>
              <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                <span className="text-gray-300">{m.online ? <Wifi className="w-3.5 h-3.5 text-emerald-500" /> : <WifiOff className="w-3.5 h-3.5" />}</span>
                {m.battery != null && (
                  <span className={`text-[10px] flex items-center gap-0.5 ${m.battery < 20 ? 'text-red-500' : 'text-gray-400'}`}>
                    <Battery className="w-3 h-3" />{m.battery}%
                  </span>
                )}
              </div>
              <Crosshair className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            </button>
          ))}
        </div>

        {/* Footer summary */}
        <div className="p-2.5 border-t border-gray-50 flex items-center justify-around text-xs">
          <span className="flex items-center gap-1 text-emerald-600"><Wifi className="w-3.5 h-3.5" />{counts.active} actifs</span>
          <span className="flex items-center gap-1 text-red-600"><AlertTriangle className="w-3.5 h-3.5" />{counts.alert} violations</span>
          <span className="flex items-center gap-1 text-gray-400"><WifiOff className="w-3.5 h-3.5" />{counts.offline} hors ligne</span>
        </div>
      </div>
    </div>
  );
}
