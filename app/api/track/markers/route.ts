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

  const [cases, positions, geofencesRaw] = await Promise.all([
    fetchCases(session.role, session.id),
    fetchLatestPositions(),
    fetchGeofences(),
  ]);

  const markers: TrackerMarker[] = positions.map((pos) => {
    const relatedCase = cases.find((c) => c.id === pos.case_id);
    const device = relatedCase?.device;
    return {
      id: pos.id,
      caseRef: pos.case_number,
      label: relatedCase?.individual?.full_name ?? pos.case_number,
      lat: pos.latitude,
      lng: pos.longitude,
      status: STATUS_TO_TRACKER[relatedCase?.status ?? 'PENDING'] ?? 'offline',
      lastUpdate: new Date(pos.recorded_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
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
