import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canManageGeofences , allow } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// POST /api/track/geofence — create a geofence drawn on the surveillance map.
// Body: { caseId, name, isExclusion, shape: 'polygon'|'circle',
//         coordinates?: [lng,lat][], center?: [lat,lng], radiusM?: number }
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canManageGeofences(session.role), 'geofences')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  let body: {
    caseId?: string; name?: string; isExclusion?: boolean;
    shape?: 'polygon' | 'circle';
    coordinates?: number[][]; center?: [number, number]; radiusM?: number;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }

  const { caseId, shape } = body;
  const name = body.name?.trim();
  if (!caseId || !name || !shape) {
    return NextResponse.json({ error: 'Champs manquants (caseId, name, shape)' }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    case_id: caseId,
    name,
    geofence_type: 'GPS_ZONE',
    shape_type: shape === 'circle' ? 'CIRCLE' : 'POLYGON',
    is_exclusion: Boolean(body.isExclusion),
    created_by: session.id,
    area: null, center_lat: null, center_lon: null, radius_m: null,
  };

  if (shape === 'circle') {
    if (!body.center || body.radiusM == null) return NextResponse.json({ error: 'Cercle invalide' }, { status: 400 });
    row.center_lat = body.center[0];
    row.center_lon = body.center[1];
    row.radius_m = Math.round(body.radiusM);
  } else {
    if (!body.coordinates || body.coordinates.length < 3) return NextResponse.json({ error: 'Polygone invalide' }, { status: 400 });
    row.area = { type: 'Polygon', coordinates: [body.coordinates] };
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 });

  const { error } = await supabase.from('geofences').insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  { const { writeAudit } = await import('@/lib/audit/log'); await writeAudit({ userId: session.id, action: 'DRAW_GEOFENCE', tableName: 'geofences', recordId: caseId, newData: { name } }); }
  return NextResponse.json({ ok: true });
}
