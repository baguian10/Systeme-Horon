import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { fetchCases, fetchLatestPositions, fetchGeofences } from '@/lib/mock/helpers';
import type { TrackerMarker, MapGeofence } from '@/components/map/TrackingMap';

export const dynamic = 'force-dynamic';

const STATUS_TO_TRACKER: Record<string, TrackerMarker['status']> = {
  ACTIVE: 'active', VIOLATION: 'alert', PENDING: 'offline',
  SUSPENDED: 'offline', TERMINATED: 'offline',
};

// GET /api/track/markers — live tracker markers + geofences for the signed-in user.
// Polled by the map to move markers without remounting (keeps zoom/pan).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ markers: [], geofences: [] }, { status: 401 });

  // Viewer-driven refresh: on Vercel Hobby per-minute cron is not allowed, so
  // pull a fresh Traxbean fix (and run the geofence/alert pipeline) on each map
  // poll. Keeps the map live while open without an external scheduler.
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.CRON_SECRET;
  if (base && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      await fetch(`${base}/api/cron/poll-traxbean?secret=${secret ?? ''}`, { cache: 'no-store' });
    } catch {
      // best-effort — fall through to reading whatever is in the DB
    }
  }

  const [cases, positions, geofencesRaw] = await Promise.all([
    fetchCases(session.role, session.id),
    fetchLatestPositions(),
    fetchGeofences(),
  ]);

  // Only surface markers for cases that are actively monitored AND carry an
  // assigned device. Positions linger in history after a bracelet is removed or
  // a case is closed/suspended; without this guard those orphan fixes rendered
  // as live "network signals" on the surveillance map for inactive/unassigned
  // accounts. Mirrors the monitoring console filter (monitoring/page.tsx).
  const monitoredById = new Map(
    cases
      .filter((c) => (c.status === 'ACTIVE' || c.status === 'VIOLATION') && c.device != null)
      .map((c) => [c.id, c]),
  );

  const markers: TrackerMarker[] = positions
    .filter((pos) => monitoredById.has(pos.case_id))
    .map((pos) => {
    const relatedCase = monitoredById.get(pos.case_id)!;
    const device = relatedCase?.device;
    return {
      id: pos.id,
      caseId: pos.case_id,
      caseRef: pos.case_number,
      label: relatedCase?.individual?.full_name ?? pos.case_number,
      lat: pos.latitude,
      lng: pos.longitude,
      status: STATUS_TO_TRACKER[relatedCase?.status ?? 'PENDING'] ?? 'offline',
      lastUpdate: new Date(pos.recorded_at).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Ouagadougou', hour: '2-digit', minute: '2-digit' }),
      battery: device?.battery_pct ?? null,
      speedKmh: pos.speed_kmh ?? null,
      online: device?.is_online ?? false,
    };
  });

  const geofences: MapGeofence[] = geofencesRaw.map((g) => ({
    id: g.id,
    name: g.name,
    isExclusion: g.is_exclusion,
    polygon: g.area?.coordinates?.[0]
      ? g.area.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
      : null,
    center: g.center_lat != null && g.center_lon != null ? [g.center_lat, g.center_lon] : null,
    radiusM: g.radius_m ?? null,
  }));

  return NextResponse.json({ markers, geofences });
}
