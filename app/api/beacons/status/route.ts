import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['SPARE', 'ACTIVE', 'FAULTY']);

// POST /api/beacons/status — set a beacon's status (e.g. mark FAULTY). SUPER_ADMIN.
// Body: { beaconId, status }
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !canConfigureHardware(session.role)) {
    return NextResponse.json({ error: 'Accès refusé (SUPER_ADMIN requis)' }, { status: 403 });
  }
  let body: { beaconId?: string; status?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const { beaconId, status } = body;
  if (!beaconId || !status || !ALLOWED.has(status)) {
    return NextResponse.json({ error: 'beaconId / status invalide' }, { status: 400 });
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 });
  const { error } = await sb.from('beacons').update({ status }).eq('id', beaconId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
