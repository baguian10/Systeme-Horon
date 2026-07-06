import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware, allow } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// POST /api/beacons/delete — permanently remove a BLE beacon. SUPER_ADMIN only.
// Beacons hold no judicial history of their own (alerts reference the case/device,
// not the beacon), so deletion is safe. The beacon is simply removed from the
// inventory; any bracelet link disappears with it.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'beacons')) {
    return NextResponse.json({ error: 'Accès refusé (SUPER_ADMIN requis)' }, { status: 403 });
  }
  let body: { beaconId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const beaconId = body.beaconId?.trim();
  if (!beaconId) return NextResponse.json({ error: 'beaconId requis' }, { status: 400 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 });

  const { data: beacon } = await sb.from('beacons').select('id, uid').eq('id', beaconId).maybeSingle();
  if (!beacon) return NextResponse.json({ error: 'Balise introuvable' }, { status: 404 });

  const { error } = await sb.from('beacons').delete().eq('id', beaconId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  { const { writeAudit } = await import('@/lib/audit/log'); await writeAudit({ userId: session.id, action: 'DELETE_BEACON', tableName: 'beacons', recordId: beaconId, oldData: { uid: beacon.uid } }); }
  return NextResponse.json({ ok: true });
}
