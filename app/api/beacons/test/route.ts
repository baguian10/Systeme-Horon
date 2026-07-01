import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware, allow } from '@/lib/auth/permissions';
import { isTraxbeanConfigured, sendDeviceCommand, getLatestBleScan } from '@/lib/traxbean/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// POST /api/beacons/test  { beaconId }
// Real pairing test: asks the linked bracelet to run a BLE scan, then checks
// whether THIS beacon's MAC is actually detected (and at what RSSI). Confirms
// the home beacon is physically reachable by the ankle tracker.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'beacons')) {
    return NextResponse.json({ error: 'Accès refusé (SUPER_ADMIN requis)' }, { status: 403 });
  }
  if (!isTraxbeanConfigured()) {
    return NextResponse.json({ error: 'Plateforme GPS non configurée (TRAXBEAN_TOKEN).' }, { status: 503 });
  }

  let body: { beaconId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const beaconId = body.beaconId?.trim();
  if (!beaconId) return NextResponse.json({ error: 'beaconId manquant' }, { status: 400 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 });

  const { data: beacon } = await sb.from('beacons').select('id, uid, min_rssi, device_id').eq('id', beaconId).maybeSingle();
  const b = beacon as { id: string; uid: string; min_rssi: number | null; device_id: string | null } | null;
  if (!b) return NextResponse.json({ error: 'Balise introuvable' }, { status: 404 });
  if (!b.device_id) return NextResponse.json({ error: 'Liez d\'abord la balise à un bracelet pour la tester.' }, { status: 400 });

  const { data: device } = await sb.from('devices').select('imei').eq('id', b.device_id).maybeSingle();
  const imei = (device as { imei?: string } | null)?.imei;
  if (!imei) return NextResponse.json({ error: 'Bracelet lié introuvable' }, { status: 404 });

  // 1. Trigger a BLE scan on the bracelet, 2. give it time, 3. read the scan.
  const commanded = await sendDeviceCommand(imei, 'enableBle');
  await new Promise((r) => setTimeout(r, 8000));
  const scan = await getLatestBleScan(imei);

  // Freshness guard — never report a stale scan as "connected". The tracker
  // scans in bursts; if the newest scan is old the device isn't scanning now,
  // so the beacon status is UNKNOWN, not "detected".
  const STALE_MIN = 5;
  const scanAgeMin = scan?.at ? (Date.now() - Date.parse(scan.at)) / 60000 : null;
  const stale = scanAgeMin === null || scanAgeMin > STALE_MIN;

  const targetMac = (b.uid ?? '').trim().toUpperCase();
  const hit = !stale ? (scan?.sightings.find((s) => s.mac === targetMac) ?? null) : null;
  const threshold = b.min_rssi ?? -85;
  const detected = !stale && Boolean(hit);
  const strongEnough = Boolean(hit && hit.rssi >= threshold);

  // Everything the tracker currently sees (fresh scans only) — lets the operator
  // identify a beacon's MAC to pair it.
  const sightings = (!stale && scan ? scan.sightings : [])
    .slice()
    .sort((a, c) => c.rssi - a.rssi)
    .map((s) => ({ name: s.name, mac: s.mac, rssi: s.rssi }));

  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'BEACON_TEST', tableName: 'beacons', recordId: b.id, newData: { detected, stale, rssi: hit?.rssi ?? null } });

  return NextResponse.json({
    ok: true,
    detected,
    strongEnough,
    stale,
    rssi: hit?.rssi ?? null,
    threshold,
    scanAt: scan?.at ?? null,
    scanAgeMin: scanAgeMin === null ? null : Math.round(scanAgeMin),
    sightings,
    reason: !commanded ? 'Commande de scan non transmise au bracelet'
      : !scan ? 'Aucun scan BLE reçu du bracelet — le module BLE est éteint ou le bracelet hors ligne'
      : stale ? `Aucun scan récent (dernier il y a ${Math.round(scanAgeMin!)} min) — le bracelet ne scanne pas actuellement, statut inconnu`
      : !detected ? 'Balise non détectée par le bracelet (hors de portée)'
      : !strongEnough ? `Détectée mais signal faible (${hit!.rssi} dBm < seuil ${threshold})`
      : `Détectée (${hit!.rssi} dBm)`,
  });
}
