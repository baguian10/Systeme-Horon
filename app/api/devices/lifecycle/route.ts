import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware, allow } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// POST /api/devices/lifecycle — move a bracelet through its lifecycle.
// Body: { deviceId, action: 'retire' | 'restore' | 'maintenance', reason? }
// SUPER_ADMIN only. RETIRED is the proper decommission for a device that carries
// judicial history (and so cannot be hard-deleted): it is kept for audit but
// removed from the active pool and never offered for assignment again.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'hardware')) {
    return NextResponse.json({ error: 'Accès refusé (SUPER_ADMIN requis)' }, { status: 403 });
  }
  let body: { deviceId?: string; action?: string; reason?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const deviceId = body.deviceId?.trim();
  const action = body.action;
  if (!deviceId || !action) return NextResponse.json({ error: 'deviceId / action requis' }, { status: 400 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 });

  const { data: device } = await sb.from('devices').select('id, imei, case_id').eq('id', deviceId).maybeSingle();
  if (!device) return NextResponse.json({ error: 'Bracelet introuvable' }, { status: 404 });

  let patch: Record<string, unknown>;
  if (action === 'retire') {
    if (device.case_id) return NextResponse.json({ error: 'Bracelet assigné — désassignez-le avant la réforme.' }, { status: 409 });
    patch = { lifecycle_status: 'RETIRED', retired_at: new Date().toISOString(), retired_reason: body.reason?.trim() || null };
  } else if (action === 'maintenance') {
    patch = { lifecycle_status: 'MAINTENANCE' };
  } else if (action === 'restore') {
    patch = { lifecycle_status: device.case_id ? 'ACTIVE' : 'STOCK', retired_at: null, retired_reason: null };
  } else {
    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  }

  const { error } = await sb.from('devices').update(patch).eq('id', deviceId);
  if (error) {
    const missing = /column .*lifecycle_status.* does not exist/i.test(error.message);
    return NextResponse.json({ error: missing ? 'Migration cycle de vie non appliquée (device_lifecycle.sql).' : error.message }, { status: missing ? 409 : 500 });
  }

  { const { writeAudit } = await import('@/lib/audit/log'); await writeAudit({ userId: session.id, action: `DEVICE_${action.toUpperCase()}`, tableName: 'devices', recordId: deviceId, newData: { imei: device.imei, ...patch } }); }
  return NextResponse.json({ ok: true });
}
