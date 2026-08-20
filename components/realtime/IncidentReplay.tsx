'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ReplayPoint } from '@/components/track/HistoryReplayMap';

const HistoryReplayMap = dynamic(() => import('@/components/track/HistoryReplayMap'), { ssr: false });
const HistoryTimeline = dynamic(() => import('@/components/track/HistoryTimeline'), { ssr: false });

const WINDOW_MS = 30 * 60_000; // ±30 min around the trigger

// Replays the device's track in a window around an alert trigger time.
export default function IncidentReplay({ caseId, triggeredAt }: { caseId: string; triggeredAt: string }) {
  const triggerMs = useMemo(() => Date.parse(triggeredAt), [triggeredAt]);
  const [points, setPoints] = useState<ReplayPoint[]>([]);
  const [matched, setMatched] = useState<[number, number][] | null>(null);
  const [loading, setLoading] = useState(true);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(8);
  const raf = useRef<number | null>(null);
  const last = useRef(0);

  useEffect(() => {
    let active = true;
    const from = new Date(triggerMs - WINDOW_MS).toISOString();
    const to = new Date(triggerMs + WINDOW_MS).toISOString();
    fetch(`/api/track/history?caseId=${encodeURIComponent(caseId)}&from=${from}&to=${to}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const pts: ReplayPoint[] = Array.isArray(d.points) ? d.points : [];
        setPoints(pts);
        setMatched(Array.isArray(d.matched) ? d.matched : null);
        setPlayhead(pts.length ? pts[0].t : triggerMs);
      })
      .catch(() => active && setPoints([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [caseId, triggerMs]);

  const min = points.length ? points[0].t : triggerMs - WINDOW_MS;
  const max = points.length ? points[points.length - 1].t : triggerMs + WINDOW_MS;

  useEffect(() => {
    if (!playing || max <= min) return;
    last.current = performance.now();
    const tick = (n: number) => {
      const dt = n - last.current; last.current = n;
      setPlayhead((p) => { const nx = p + dt * speed; if (nx >= max) { setPlaying(false); return max; } return nx; });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [playing, speed, min, max]);

  // Le trajet était tracé d'un seul trait : deux points séparés de dix minutes
  // devenaient une ligne droite parfaitement affirmée, alors que personne ne
  // sait ce qui s'est passé entre les deux. On coupe donc le tracé à chaque
  // silence de plus d'une minute et demie — le trou se voit au lieu d'être
  // comblé. Quand un moteur de recalage est configuré, sa trace remplace le
  // tout : elle suit les rues et restitue les virages.
  const GAP_MS = 90_000;
  const segments = useMemo(() => {
    if (matched && matched.length > 1) return [matched];
    const out: [number, number][][] = [];
    let cur: [number, number][] = [];
    for (let i = 0; i < points.length; i++) {
      if (i > 0 && points[i].t - points[i - 1].t > GAP_MS) { if (cur.length > 1) out.push(cur); cur = []; }
      cur.push([points[i].lat, points[i].lng]);
    }
    if (cur.length > 1) out.push(cur);
    return out;
  }, [points, matched]);

  if (loading) return <div className="h-full flex items-center justify-center text-sm text-gray-400">Chargement du rejeu…</div>;
  if (points.length === 0) return <div className="h-full flex items-center justify-center text-sm text-gray-400">Pas de positions autour de l&apos;incident.</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <HistoryReplayMap points={points} segments={segments} stops={[]} geofences={[]} playheadT={playhead} />
      </div>
      <HistoryTimeline
        min={min} max={max} value={playhead} playing={playing} speed={speed}
        events={[{ t: triggerMs, type: 'EXIT', isExclusion: true }]}
        onChange={(t) => { setPlaying(false); setPlayhead(t); }}
        onTogglePlay={() => { if (playhead >= max) setPlayhead(min); setPlaying((p) => !p); }}
        onSpeed={setSpeed}
      />
    </div>
  );
}
