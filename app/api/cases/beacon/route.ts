import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// POST /api/cases/beacon — link/unlink a BLE beacon to a case's bracelet.
// Body: { caseId, beaconId, action: 'link' | 'unlink' }
// JUDGE may manage beacons for their OWN cases; SUPER_ADMIN for any.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !canConfigureHardware(session.role)) {
    return NextResponse.json({ error: 'Accès refusé (SUPER_ADMIN requis)' }, { status: 403 });
  }

  let body: { caseId?: string; beaconId?: string; action?: 'link' | 'unlink' };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const { caseId, beaconId, action } = body;
  if (!caseId || !beaconId || !action) return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 });

  const { data: device } = await sb.from('devices').select('id').eq('case_id', caseId).single();
  if (!device) return NextResponse.json({ error: 'Aucun bracelet assigné à ce dossier' }, { status: 400 });

  if (action === 'link') {
    // bracelet holds at most one beacon → free any current one first
    await sb.from('beacons').update({ device_id: null, status: 'SPARE' }).eq('device_id', device.id);
    const { error } = await sb.from('beacons').update({ device_id: device.id, status: 'ACTIVE' }).eq('id', beaconId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb.from('beacons').update({ device_id: null, status: 'SPARE' }).eq('id', beaconId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
