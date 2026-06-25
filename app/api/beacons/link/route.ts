import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware , allow } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// POST /api/beacons/link — pair a beacon with a bracelet, reassign, or unlink.
// Body: { beaconId, deviceId }  (deviceId null/empty → unlink). SUPER_ADMIN.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'beacons')) {
    return NextResponse.json({ error: 'Accès refusé (SUPER_ADMIN requis)' }, { status: 403 });
  }
  let body: { beaconId?: string; deviceId?: string | null };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const { beaconId } = body;
  const deviceId = body.deviceId || null;
  if (!beaconId) return NextResponse.json({ error: 'beaconId manquant' }, { status: 400 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 });

  if (deviceId) {
    // A bracelet holds at most one beacon (device_id is UNIQUE) — free any current one.
    await sb.from('beacons').update({ device_id: null, status: 'SPARE' }).eq('device_id', deviceId);
    const { error } = await sb.from('beacons').update({ device_id: deviceId, status: 'ACTIVE' }).eq('id', beaconId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb.from('beacons').update({ device_id: null, status: 'SPARE' }).eq('id', beaconId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  { const { writeAudit } = await import('@/lib/audit/log'); await writeAudit({ userId: session.id, action: 'LINK_BEACON', tableName: 'beacons', recordId: beaconId, newData: { deviceId } }); }
  return NextResponse.json({ ok: true });
}
