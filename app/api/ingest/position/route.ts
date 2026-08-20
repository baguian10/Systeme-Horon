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

  // Anti-doublon : le bracelet garde le même horodatage tant qu'il n'a pas
  // recalculé sa position. Deux collectes rapprochées — le battement de la
  // console et le passage complet — rapportent alors la même mesure. Sans ce
  // garde-fou la table se remplit de copies : 25 000 lignes portant la même
  // seconde y ont déjà été observées.
  const stamp = timestamp ?? new Date().toISOString();
  const { data: lastPos } = await supabase
    .from('positions').select('recorded_at, seal_seq, seal_hash')
    .eq('device_id', device.id).order('recorded_at', { ascending: false }).limit(1).maybeSingle();
  const last = lastPos as { recorded_at?: string; seal_seq?: number | null; seal_hash?: string | null } | null;
  if (last?.recorded_at === stamp) {
    await supabase.from('devices').update({ is_online: true, last_seen_at: new Date().toISOString() }).eq('id', device.id);
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // Scellé : chaque relevé porte l'empreinte du précédent, de sorte qu'une
  // retouche ultérieure casse la chaîne et se voie. Les colonnes arrivent par
  // migration ; tant qu'elles manquent, l'insertion se fait sans elles plutôt
  // que d'échouer — une position non scellée vaut mieux qu'une position perdue.
  const { sealHash } = await import('@/lib/track/seal');
  const prevHash = last?.seal_hash ?? null;
  const seal = {
    seal_seq: (last?.seal_seq ?? 0) + 1,
    seal_prev: prevHash,
    seal_hash: sealHash({ deviceId: device.id, recordedAt: stamp, lat, lng: lon, prev: prevHash }),
  };

  // Insert position
  const row = {
    device_id: device.id,
    case_id: device.case_id,
    latitude: lat,
    longitude: lon,
    accuracy_m: accuracy_m ?? null,
    speed_kmh: speed_kmh ?? null,
    recorded_at: stamp,
  };
  const { error: insErr } = await supabase.from('positions').insert({ ...row, ...seal });
  if (insErr) await supabase.from('positions').insert(row); // colonnes de scellé absentes

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
