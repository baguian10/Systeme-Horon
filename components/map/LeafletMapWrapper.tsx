'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { TrackerMarker } from './TrackingMap';

const TrackingMap = dynamic(() => import('./TrackingMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-gray-400">Chargement de la carte…</p>
      </div>
    </div>
  ),
});

// Polls live markers and updates them in place — the map keeps the user's
// current zoom/pan (no server re-render, no remount).
export default function LeafletMapWrapper({
  markers: initialMarkers,
  pollMs = 15000,
}: {
  markers: TrackerMarker[];
  pollMs?: number;
}) {
  const [markers, setMarkers] = useState<TrackerMarker[]>(initialMarkers);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch('/api/track/markers', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { markers: TrackerMarker[] };
        if (active && Array.isArray(data.markers) && data.markers.length > 0) {
          setMarkers(data.markers);
        }
      } catch {
        // ignore transient errors
      }
    }
    const id = setInterval(poll, pollMs);
    poll();
    return () => { active = false; clearInterval(id); };
  }, [pollMs]);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <TrackingMap markers={markers} />
    </div>
  );
}
