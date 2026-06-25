import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware , allow } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

async function admin() {
  const { createAdminClient } = await import('@/lib/supabase/admin');
  return createAdminClient();
}

// GET /api/beacons — list all BLE beacons (SUPER_ADMIN).
export async function GET() {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'beacons')) {
    return NextResponse.json({ beacons: [] }, { status: 403 });
  }
  const sb = await admin();
  if (!sb) return NextResponse.json({ beacons: [] }, { status: 503 });
  const { data } = await sb
    .from('beacons')
    .select('id, uid, label, status, device_id, alarm_enabled, max_distance_m, grace_minutes, notify_exit, active_start, active_end, home_lat, home_lng, device:devices(imei, case_id)')
    .order('created_at', { ascending: false });
  return NextResponse.json({ beacons: data ?? [] });
}

// POST /api/beacons — register a new beacon { uid, label }.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'beacons')) {
    return NextResponse.json({ error: 'Accès refusé (SUPER_ADMIN requis)' }, { status: 403 });
  }
  let body: { uid?: string; label?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const uid = body.uid?.trim();
  if (!uid) return NextResponse.json({ error: 'UID requis' }, { status: 400 });

  const sb = await admin();
  if (!sb) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 });
  const { error } = await sb.from('beacons').insert({ uid, label: body.label?.trim() || null, status: 'SPARE' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
