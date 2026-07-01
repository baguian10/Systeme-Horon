import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware, allow } from '@/lib/auth/permissions';
import { isTraxbeanConfigured, sendDeviceCommand, getLatestBleScan } from '@/lib/traxbean/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// POST /api/devices/ble-scan  { imei }
// Manual BLE scan at the tracker level (not tied to a paired beacon): turns on
// the bracelet's BLE, reads what it sees, and returns every nearby BLE device
// (MAC, name, RSSI, distance). Lets an operator stand in front of a tracker and
// find a beacon's MAC before pairing it. Freshness-guarded: a stale scan is
// reported as unknown, never as a live result.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'hardware')) {
    return NextResponse.json({ error: 'Accès refusé (SUPER_ADMIN requis)' }, { status: 403 });
  }
  if (!isTraxbeanConfigured()) {
    return NextResponse.json({ error: 'Plateforme GPS non configurée.' }, { status: 503 });
  }
  let body: { imei?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const imei = body.imei?.trim();
  if (!imei) return NextResponse.json({ error: 'imei manquant' }, { status: 400 });

  const commanded = await sendDeviceCommand(imei, 'enableBle');
  await new Promise((r) => setTimeout(r, 8000));
  const scan = await getLatestBleScan(imei);

  const STALE_MIN = 5;
  const scanAgeMin = scan?.at ? (Date.now() - Date.parse(scan.at)) / 60000 : null;
  const stale = scanAgeMin === null || scanAgeMin > STALE_MIN;

  const { rssiToMeters } = await import('@/lib/traxbean/rssi');
  const sightings = (!stale && scan ? scan.sightings : [])
    .slice()
    .sort((a, b) => b.rssi - a.rssi)
    .map((s) => ({ name: s.name, mac: s.mac, rssi: s.rssi, meters: rssiToMeters(s.rssi) }));

  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'BLE_SCAN', tableName: 'devices', recordId: imei, newData: { count: sightings.length, stale } });

  return NextResponse.json({
    ok: true,
    stale,
    commanded,
    scanAgeMin: scanAgeMin === null ? null : Math.round(scanAgeMin),
    sightings,
    reason: !commanded ? 'Commande de scan non transmise au bracelet'
      : !scan ? 'Aucun scan BLE reçu — module BLE éteint ou bracelet hors ligne'
      : stale ? `Aucun scan récent (dernier il y a ${Math.round(scanAgeMin!)} min) — le bracelet ne scanne pas actuellement`
      : sightings.length === 0 ? 'Le bracelet scanne mais ne capte aucun BLE. S\'il est porté, le corps atténue fortement le signal — retirez-le et posez-le près de la balise pour l\'appairage.'
      : `${sightings.length} appareil(s) BLE détecté(s)`,
  });
}
