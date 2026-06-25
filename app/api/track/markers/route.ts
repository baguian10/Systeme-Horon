import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { fetchCases, fetchLatestPositions } from '@/lib/mock/helpers';
import type { TrackerMarker } from '@/components/map/TrackingMap';

export const dynamic = 'force-dynamic';

const STATUS_TO_TRACKER: Record<string, TrackerMarker['status']> = {
  ACTIVE: 'active', VIOLATION: 'alert', PENDING: 'offline',
  SUSPENDED: 'offline', TERMINATED: 'offline',
};

// GET /api/track/markers — live tracker markers for the signed-in user.
// Polled by the map to move markers without remounting (keeps zoom/pan).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ markers: [] }, { status: 401 });

  const [cases, positions] = await Promise.all([
    fetchCases(session.role, session.id),
    fetchLatestPositions(),
  ]);

  const markers: TrackerMarker[] = positions.map((pos) => {
    const relatedCase = cases.find((c) => c.id === pos.case_id);
    return {
      id: pos.id,
      caseRef: pos.case_number,
      label: relatedCase?.individual?.full_name ?? pos.case_number,
      lat: pos.latitude,
      lng: pos.longitude,
      status: STATUS_TO_TRACKER[relatedCase?.status ?? 'PENDING'] ?? 'offline',
      lastUpdate: new Date(pos.recorded_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      geofenceRadius: relatedCase?.geofences?.[0] ? 500 : undefined,
    };
  });

  return NextResponse.json({ markers });
}
