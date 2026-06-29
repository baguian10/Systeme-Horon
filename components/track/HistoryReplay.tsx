'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import DayPicker from './DayPicker';
import HistoryTimeline from './HistoryTimeline';
import type { ReplayPoint, ReplayStop, ReplayGeofence } from './HistoryReplayMap';

const HistoryReplayMap = dynamic(() => import('./HistoryReplayMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

interface CurfewReport {
  windows: { zoneName: string; start: string; end: string }[];
  compliant: boolean;
  violations: { from: number; to: number; mins: number }[];
  outsideMin: number;
}
interface GeoEvent { t: number; type: 'ENTER' | 'EXIT'; zoneName: string; isExclusion: boolean }
interface Stats { distanceKm: number; maxSpeedKmh: number; avgSpeedKmh: number; activeMin: number; firstSeen: number | null; lastSeen: number | null; pointCount: number }

interface DayData {
  date: string;
  points: ReplayPoint[];
  segments: [number, number][][];
  stops: ReplayStop[];
  events: GeoEvent[];
  stats: Stats;
  curfew: CurfewReport;
  geofences: ReplayGeofence[];
}

export default function HistoryReplay({ caseId, initialDate }: { caseId: string; initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [playheadT, setPlayheadT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [focusStop, setFocusStop] = useState<number | null>(null);

  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);

  // Load the selected day.
  useEffect(() => {
    let active = true;
    // Intentional: reset loading/playback state when the selected day changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setPlaying(false);
    fetch(`/api/track/history?caseId=${encodeURIComponent(caseId)}&date=${date}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: DayData) => {
        if (!active) return;
        setData(d);
        setPlayheadT(d.stats.firstSeen ?? 0);
      })
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [caseId, date]);

  const min = data?.stats.firstSeen ?? 0;
  const max = data?.stats.lastSeen ?? 0;

  // rAF playback loop.
  useEffect(() => {
    if (!playing || !data || max <= min) return;
    lastFrameRef.current = performance.now();
    const tick = (now: number) => {
      const dt = now - lastFrameRef.current;
      lastFrameRef.current = now;
      setPlayheadT((prev) => {
        const next = prev + dt * speed;
        if (next >= max) {
          setPlaying(false);
          return max;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, speed, data, min, max]);

  const togglePlay = useCallback(() => {
    if (!data || max <= min) return;
    setPlaying((p) => {
      if (!p && playheadT >= max) setPlayheadT(min); // restart from beginning
      return !p;
    });
  }, [data, min, max, playheadT]);

  const hasData = !!data && data.points.length > 0;
  const events = useMemo(() => (data?.events ?? []).map((e) => ({ t: e.t, type: e.type, isExclusion: e.isExclusion })), [data]);

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-[300px] shrink-0 border-r border-gray-200 bg-white overflow-y-auto p-3 space-y-3">
          <DayPicker caseId={caseId} value={date} onChange={setDate} />

          {loading && <p className="text-sm text-gray-500 px-1">Chargement…</p>}

          {!loading && !hasData && (
            <p className="text-sm text-gray-500 px-1 py-4 text-center">Aucun déplacement enregistré ce jour-là.</p>
          )}

          {hasData && data && (
            <>
              {/* Curfew banner */}
              {data.curfew.windows.length > 0 && (
                <div className={`rounded-lg p-3 text-sm ${data.curfew.compliant ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                  <div className="font-semibold">{data.curfew.compliant ? '✓ Couvre-feu respecté' : '✗ Couvre-feu non respecté'}</div>
                  {!data.curfew.compliant && <div className="text-xs mt-1">{data.curfew.outsideMin} min hors zone · {data.curfew.violations.length} infraction(s)</div>}
                  <div className="text-xs text-gray-500 mt-1">{data.curfew.windows.map((w) => `${w.zoneName} ${w.start}–${w.end}`).join(' · ')}</div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Distance" value={`${data.stats.distanceKm} km`} />
                <Stat label="Vitesse max" value={`${data.stats.maxSpeedKmh} km/h`} />
                <Stat label="Temps actif" value={`${data.stats.activeMin} min`} />
                <Stat label="Points GPS" value={`${data.stats.pointCount}`} />
              </div>

              {/* Stops */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Arrêts ({data.stops.length})</h3>
                <ul className="space-y-1">
                  {data.stops.map((s, i) => (
                    <li key={i}>
                      <button
                        onClick={() => { setFocusStop(i); setPlayheadT(s.start); }}
                        className="w-full text-left rounded-lg border border-gray-100 hover:bg-violet-50 px-2.5 py-2 text-sm"
                      >
                        <div className="flex justify-between">
                          <span className="font-semibold text-amber-600">#{i + 1}</span>
                          <span className="text-gray-500">{s.durationMin} min</span>
                        </div>
                        <div className="text-xs text-gray-500">{fmt(s.start)} → {fmt(s.end)}</div>
                        <div className="text-xs text-gray-700 truncate">{s.address ?? `${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`}</div>
                      </button>
                    </li>
                  ))}
                  {data.stops.length === 0 && <li className="text-xs text-gray-400 px-1">Aucun arrêt prolongé.</li>}
                </ul>
              </div>

              {/* Geofence events */}
              {data.events.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Événements zones</h3>
                  <ul className="space-y-1 text-sm">
                    {data.events.map((e, i) => (
                      <li key={i} className="flex justify-between">
                        <span className={e.isExclusion ? 'text-red-600' : 'text-blue-600'}>
                          {e.type === 'ENTER' ? '→ Entrée' : '← Sortie'} {e.zoneName}
                        </span>
                        <span className="text-gray-400 text-xs">{fmt(e.t)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <a
                href={`/api/track/history/report?caseId=${encodeURIComponent(caseId)}&date=${date}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center bg-gray-900 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-gray-800"
              >
                🖨️ Rapport PDF du jour
              </a>
            </>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 min-w-0">
          {hasData && data ? (
            <HistoryReplayMap
              points={data.points}
              segments={data.segments}
              stops={data.stops}
              geofences={data.geofences}
              playheadT={playheadT}
              focusStop={focusStop}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
              {loading ? 'Chargement de la carte…' : 'Sélectionnez un jour avec des données.'}
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      {hasData && max > min && (
        <HistoryTimeline
          min={min}
          max={max}
          value={playheadT}
          playing={playing}
          speed={speed}
          events={events}
          onChange={(t) => { setPlaying(false); setPlayheadT(t); }}
          onTogglePlay={togglePlay}
          onSpeed={setSpeed}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-2">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function fmt(ms: number): string {
  return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}
