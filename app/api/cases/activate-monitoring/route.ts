import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canUpdateCaseStatus } from '@/lib/auth/permissions';
import { isTraxbeanConfigured, getDeviceLocation, sendDeviceCommand, configureDevice } from '@/lib/traxbean/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// POST /api/cases/activate-monitoring  { caseId }
// Activation handshake: a case only goes ACTIVE once its bracelet is verified
// reachable. Configures timezone (BF), forces a fix, confirms the platform
// returns a fresh position, then flips the case to ACTIVE. No live device →
// activation is refused with a clear reason.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !canUpdateCaseStatus(session.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  let body: { caseId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const caseId = body.caseId?.trim();
  if (!caseId) return NextResponse.json({ error: 'caseId manquant' }, { status: 400 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 });

  const { data: device } = await sb.from('devices').select('id, imei').eq('case_id', caseId).maybeSingle();
  const dev = device as { id: string; imei: string } | null;
  if (!dev?.imei) {
    return NextResponse.json({ ok: false, activated: false, reason: 'Aucun bracelet assigné à ce dossier.' }, { status: 200 });
  }

  // Demo / no platform: activate directly (no real device to reach).
  if (!isTraxbeanConfigured()) {
    await sb.from('cases').update({ status: 'ACTIVE', start_date: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', caseId);
    const { writeAudit } = await import('@/lib/audit/log');
    await writeAudit({ userId: session.id, action: 'ACTIVATE_MONITORING', tableName: 'cases', recordId: caseId, newData: { verified: false, demo: true } });
    return NextResponse.json({ ok: true, activated: true, verified: false, reason: 'Activé (plateforme GPS non configurée — sans vérification).' });
  }

  // 1. Set the bracelet timezone to Burkina Faso (best effort).
  await configureDevice(dev.imei, 'timezoneBF');
  // 2. Force an immediate fix, 3. wait, 4. read it back.
  await sendDeviceCommand(dev.imei, 'locate');
  await new Promise((r) => setTimeout(r, 6000));
  const live = await getDeviceLocation(dev.imei);
  const fresh = Boolean(live && (Date.now() - Date.parse(live.recordedAt)) / 60000 < 10);

  if (!fresh) {
    return NextResponse.json({
      ok: true, activated: false,
      reason: 'Le bracelet ne répond pas — activez la surveillance une fois le contact établi.',
    });
  }

  // 5. Verified reachable → activate + record first fix.
  await sb.from('devices').update({
    is_online: true, sync_status: 'SYNCED', last_seen_at: new Date().toISOString(), last_heartbeat_at: new Date().toISOString(),
    ...(live!.battery !== null ? { battery_pct: live!.battery } : {}),
  }).eq('id', dev.id);
  await sb.from('cases').update({ status: 'ACTIVE', start_date: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', caseId);
  await sb.from('positions').insert({
    device_id: dev.id, case_id: caseId, latitude: live!.lat, longitude: live!.lng,
    speed_kmh: live!.speedKmh ?? null, recorded_at: live!.recordedAt,
  });
  const { logDeviceEvent } = await import('@/lib/devices/events');
  await logDeviceEvent(sb, { deviceId: dev.id, caseId, type: 'ONLINE', detail: 'Activation surveillance : contact confirmé', actorId: session.id });
  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'ACTIVATE_MONITORING', tableName: 'cases', recordId: caseId, newData: { verified: true } });

  return NextResponse.json({ ok: true, activated: true, verified: true, reason: 'Surveillance activée — bracelet joignable.' });
}
