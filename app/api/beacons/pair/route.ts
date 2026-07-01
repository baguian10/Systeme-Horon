import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware, allow } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// POST /api/beacons/pair  { imei, mac, label? }
// Pair a beacon straight from a tracker BLE scan: create (or reuse) a beacon
// with the scanned MAC and link it to the bracelet that saw it. Also arms the
// bracelet's BLE scan so the home alarm works immediately.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'beacons')) {
    return NextResponse.json({ error: 'Accès refusé (SUPER_ADMIN requis)' }, { status: 403 });
  }
  let body: { imei?: string; mac?: string; label?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const imei = body.imei?.trim();
  const mac = body.mac?.trim().toUpperCase();
  if (!imei || !mac) return NextResponse.json({ error: 'imei / mac manquant' }, { status: 400 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 });

  const { data: device } = await sb.from('devices').select('id').eq('imei', imei).maybeSingle();
  const deviceId = (device as { id?: string } | null)?.id;
  if (!deviceId) return NextResponse.json({ error: 'Bracelet introuvable' }, { status: 404 });

  // A bracelet holds one beacon (device_id is UNIQUE) — free any current one.
  await sb.from('beacons').update({ device_id: null, status: 'SPARE' }).eq('device_id', deviceId);

  // Reuse an existing beacon with this MAC, else create it.
  const { data: existing } = await sb.from('beacons').select('id').eq('uid', mac).maybeSingle();
  const existingId = (existing as { id?: string } | null)?.id;
  const label = body.label?.trim() || `Balise ${mac.slice(-5)}`;

  let beaconId: string | null = existingId ?? null;
  if (existingId) {
    await sb.from('beacons').update({ device_id: deviceId, status: 'ACTIVE', alarm_enabled: true }).eq('id', existingId);
  } else {
    const { data: created, error } = await sb.from('beacons')
      .insert({ uid: mac, label, device_id: deviceId, status: 'ACTIVE', alarm_enabled: true, alarm_mode: 'BLE' })
      .select('id').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    beaconId = (created as { id: string }).id;
  }

  // Arm the bracelet's BLE scan so it detects the beacon from now on.
  let bleArmed = false;
  const { isTraxbeanConfigured, sendDeviceCommand } = await import('@/lib/traxbean/client');
  if (isTraxbeanConfigured()) bleArmed = await sendDeviceCommand(imei, 'enableBle');

  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'PAIR_BEACON', tableName: 'beacons', recordId: beaconId ?? mac, newData: { imei, mac, reused: Boolean(existingId) } });

  return NextResponse.json({ ok: true, beaconId, bleArmed, reused: Boolean(existingId) });
}
