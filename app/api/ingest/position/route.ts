import { NextResponse, type NextRequest } from 'next/server';
import { enforceGeofences } from '@/lib/geofence/enforce';

// POST /api/ingest/position
// Called by the certified secure device (or the demo simulator)
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
  const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (isDemoMode) {
    return NextResponse.json({ ok: true, demo: true });
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

  // Look up device → case
  const { data: device } = await supabase
    .from('devices')
    .select('id, case_id, is_online')
    .eq('imei', imei)
    .single();

  if (!device?.case_id) {
    return NextResponse.json({ error: 'Device not assigned to a case' }, { status: 404 });
  }

  // Log the offline→online transition (device event log #2).
  if (device.is_online === false) {
    const { logDeviceEvent } = await import('@/lib/devices/events');
    await logDeviceEvent(supabase, { deviceId: device.id, caseId: device.case_id, type: 'ONLINE', detail: 'Reprise de contact' });
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

  // Geofence + curfew enforcement (shape-aware, time-windowed, graced, deduped).
  const raised = await enforceGeofences(supabase, {
    caseId: device.case_id,
    deviceId: device.id,
    lat,
    lon,
  });

  // Notify the case's judge + assigned agents for each raised violation,
  // per their preferences (best-effort — never blocks ingestion).
  if (raised.length > 0) {
    const { dispatchAlertNotifications } = await import('@/lib/notify');
    await Promise.all(raised.map((r) =>
      dispatchAlertNotifications({
        caseId: device.case_id,
        alertType: r.alert_type,
        description: (r as { description?: string | null }).description ?? null,
      })));
  }

  return NextResponse.json({ ok: true, case_id: device.case_id, alerts: raised.map((r) => r.alert_type) });
}
