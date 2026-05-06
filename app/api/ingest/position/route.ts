import { NextResponse, type NextRequest } from 'next/server';
import { checkGeofences } from '@/lib/geofence/pointInPolygon';

// POST /api/ingest/position
// Called by the ThinkRace TR40 device (or the demo simulator)
// Body: { imei, lat, lon, accuracy_m?, speed_kmh?, timestamp? }
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== process.env.INGEST_API_KEY && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    imei: string;
    lat: number;
    lon: number;
    accuracy_m?: number;
    speed_kmh?: number;
    timestamp?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { imei, lat, lon, accuracy_m, speed_kmh, timestamp } = body;
  if (!imei || lat === undefined || lon === undefined) {
    return NextResponse.json({ error: 'Missing required fields: imei, lat, lon' }, { status: 400 });
  }

  // In demo mode — just acknowledge (simulator handles state in memory)
  const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (isDemoMode) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  // Look up device → case
  const { data: device } = await supabase
    .from('devices')
    .select('id, case_id')
    .eq('imei', imei)
    .single();

  if (!device?.case_id) {
    return NextResponse.json({ error: 'Device not assigned to a case' }, { status: 404 });
  }

  // Insert position
  await supabase.from('positions').insert({
    device_id: device.id,
    case_id: device.case_id,
    latitude: lat,
    longitude: lon,
    accuracy_m: accuracy_m ?? null,
    speed_kmh: speed_kmh ?? null,
    recorded_at: timestamp ?? new Date().toISOString(),
  });

  // Update device last_seen + online status
  await supabase
    .from('devices')
    .update({ is_online: true, last_seen_at: new Date().toISOString() })
    .eq('id', device.id);

  // Geofence check
  const { data: geofences } = await supabase
    .from('geofences')
    .select('id, name, is_exclusion, area')
    .eq('case_id', device.case_id);

  if (geofences && geofences.length > 0) {
    const violation = checkGeofences(lat, lon, geofences);
    if (violation) {
      // Check: was there already an unresolved GEOFENCE_EXIT alert?
      const { count } = await supabase
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .eq('case_id', device.case_id)
        .eq('alert_type', 'GEOFENCE_EXIT')
        .eq('is_resolved', false);

      if (!count || count === 0) {
        await supabase.from('alerts').insert({
          case_id: device.case_id,
          device_id: device.id,
          alert_type: 'GEOFENCE_EXIT',
          severity: 4,
          description: `Sortie de la zone "${violation.geofenceName}" détectée à ${new Date().toLocaleTimeString('fr-FR')}.`,
          position_lat: lat,
          position_lon: lon,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, case_id: device.case_id });
}
