import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware, allow } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// POST /api/devices/delete — permanently remove a bracelet from the inventory.
// SUPER_ADMIN only. Deletion is deliberately restricted to devices that carry no
// judicial history: positions and alerts reference devices(id) with ON DELETE
// RESTRICT, so a tracked bracelet cannot (and must not) be hard-deleted — that
// would destroy evidence. Such devices should be unassigned and retired instead.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'hardware')) {
    return NextResponse.json({ error: 'Accès refusé (SUPER_ADMIN requis)' }, { status: 403 });
  }
  let body: { deviceId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const deviceId = body.deviceId?.trim();
  if (!deviceId) return NextResponse.json({ error: 'deviceId requis' }, { status: 400 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 });

  const { data: device } = await sb.from('devices').select('id, imei, case_id').eq('id', deviceId).maybeSingle();
  if (!device) return NextResponse.json({ error: 'Bracelet introuvable' }, { status: 404 });

  if (device.case_id) {
    return NextResponse.json({ error: 'Bracelet assigné à un dossier — désassignez-le d\'abord.' }, { status: 409 });
  }

  // History guards (would be blocked by RESTRICT anyway — surfaced clearly here).
  const [{ count: posCount }, { count: alertCount }, { count: beaconCount }] = await Promise.all([
    sb.from('positions').select('id', { count: 'exact', head: true }).eq('device_id', deviceId),
    sb.from('alerts').select('id', { count: 'exact', head: true }).eq('device_id', deviceId),
    sb.from('beacons').select('id', { count: 'exact', head: true }).eq('device_id', deviceId),
  ]);
  if (posCount && posCount > 0) {
    return NextResponse.json({ error: 'Historique de positions présent — suppression impossible. Retirez le bracelet du service.' }, { status: 409 });
  }
  if (alertCount && alertCount > 0) {
    return NextResponse.json({ error: 'Alertes associées présentes — suppression impossible (conservation de la preuve).' }, { status: 409 });
  }
  if (beaconCount && beaconCount > 0) {
    return NextResponse.json({ error: 'Une balise BLE est liée à ce bracelet — déliez-la d\'abord.' }, { status: 409 });
  }

  const { error } = await sb.from('devices').delete().eq('id', deviceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  { const { writeAudit } = await import('@/lib/audit/log'); await writeAudit({ userId: session.id, action: 'DELETE_DEVICE', tableName: 'devices', recordId: deviceId, oldData: { imei: device.imei } }); }
  return NextResponse.json({ ok: true });
}
