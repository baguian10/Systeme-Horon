import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware, allow } from '@/lib/auth/permissions';
import { isTraxbeanConfigured, getDeviceLocation, sendDeviceCommand } from '@/lib/traxbean/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// POST /api/devices/test-connection  { imei }
// Real connectivity check: forces an immediate fix on the bracelet (locate),
// waits, then reads the platform back. Confirms the device is actually
// reachable and updates its live status — not just a stored flag.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'hardware')) {
    return NextResponse.json({ error: 'Accès refusé (SUPER_ADMIN requis)' }, { status: 403 });
  }
  if (!isTraxbeanConfigured()) {
    return NextResponse.json({ error: 'Plateforme GPS non configurée (TRAXBEAN_TOKEN).' }, { status: 503 });
  }

  let body: { imei?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const imei = body.imei?.trim();
  if (!imei) return NextResponse.json({ error: 'imei manquant' }, { status: 400 });

  // 1. Ask the bracelet for an immediate position.
  const commanded = await sendDeviceCommand(imei, 'locate');
  // 2. Give the device a moment to acquire + upload the fix.
  await new Promise((r) => setTimeout(r, 6000));
  // 3. Read it back from the platform.
  const live = await getDeviceLocation(imei);

  const now = Date.now();
  const fixAgeMin = live ? (now - Date.parse(live.recordedAt)) / 60000 : null;
  // Reachable if we got a fresh (<10 min) fix back.
  const online = Boolean(live && fixAgeMin != null && fixAgeMin < 10);

  // Persist the observed state.
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (supabase) {
    const { data: device } = await supabase.from('devices').select('id, case_id').eq('imei', imei).maybeSingle();
    const dev = device as { id?: string; case_id?: string | null } | null;
    if (dev?.id) {
      const update: Record<string, unknown> = {
        is_online: online,
        sync_status: online ? 'SYNCED' : 'LOST',
        last_heartbeat_at: new Date().toISOString(),
      };
      if (online && live) {
        update.last_seen_at = new Date().toISOString();
        if (live.battery !== null) update.battery_pct = live.battery;
        if (live.signal !== null) update.signal_strength_dbm = live.signal;
      }
      await supabase.from('devices').update(update).eq('id', dev.id);
      const { logDeviceEvent } = await import('@/lib/devices/events');
      await logDeviceEvent(supabase, {
        deviceId: dev.id, caseId: dev.case_id ?? null,
        type: online ? 'ONLINE' : 'OFFLINE',
        detail: online ? 'Test de connexion réussi' : 'Test de connexion : pas de réponse',
        actorId: session.id,
      });
      const { writeAudit } = await import('@/lib/audit/log');
      await writeAudit({ userId: session.id, action: 'TEST_CONNECTION', tableName: 'devices', recordId: dev.id, newData: { online } });
    }
  }

  return NextResponse.json({
    ok: true,
    online,
    commanded,
    position: online && live ? { lat: live.lat, lng: live.lng, at: live.recordedAt, battery: live.battery } : null,
    reason: online ? 'Bracelet joignable' : (commanded ? 'Aucune position fraîche reçue' : 'Commande non transmise'),
  });
}
