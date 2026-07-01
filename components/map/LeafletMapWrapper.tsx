'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { TrackerMarker, MapGeofence } from './TrackingMap';

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

// Updates markers in place — keeps the user's zoom/pan (no remount).
// Primary feed = Supabase Realtime (instant push on new positions); a slow poll
// stays as a fallback and to pick up newly-added cases / geofence changes.
export default function LeafletMapWrapper({
  markers: initialMarkers,
  geofences: initialGeofences = [],
  pollMs = 30000,
}: {
  markers: TrackerMarker[];
  geofences?: MapGeofence[];
  pollMs?: number;
}) {
  const [markers, setMarkers] = useState<TrackerMarker[]>(initialMarkers);
  const [geofences, setGeofences] = useState<MapGeofence[]>(initialGeofences);

  // ── Realtime: patch a marker's position the instant a new row is inserted ──
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import('@/lib/supabase/client').then(({ createClient, IS_DEMO_MODE }) => {
      if (IS_DEMO_MODE) return;
      const supabase = createClient();
      if (!supabase) return;
      const stale = supabase.getChannels().find((c) => c.topic === 'realtime:map-positions-live');
      if (stale) supabase.removeChannel(stale);
      const channel = supabase
        .channel('map-positions-live')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'positions' }, (payload) => {
          const row = payload.new as { case_id: string; latitude: number; longitude: number; speed_kmh: number | null; recorded_at: string };
          setMarkers((prev) =>
            prev.map((m) =>
              m.caseId === row.case_id
                ? { ...m, lat: row.latitude, lng: row.longitude, speedKmh: row.speed_kmh ?? m.speedKmh, online: true, lastUpdate: new Date(row.recorded_at).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Ouagadougou' }) }
                : m,
            ),
          );
        })
        .subscribe();
      cleanup = () => { supabase.removeChannel(channel); };
    });
    return () => { cleanup?.(); };
  }, []);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch('/api/track/markers', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { markers: TrackerMarker[]; geofences?: MapGeofence[] };
        if (!active) return;
        if (Array.isArray(data.markers) && data.markers.length > 0) setMarkers(data.markers);
        if (Array.isArray(data.geofences)) setGeofences(data.geofences);
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
      <TrackingMap markers={markers} geofences={geofences} />
    </div>
  );
}
