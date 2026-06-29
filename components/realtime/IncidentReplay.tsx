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

  const segments = useMemo(() => (points.length ? [points.map((p) => [p.lat, p.lng] as [number, number])] : []), [points]);

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
