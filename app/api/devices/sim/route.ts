import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware , allow } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// POST /api/devices/sim — set the SIM card number of a bracelet. SUPER_ADMIN.
// Body: { deviceId, simNumber }
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'hardware')) {
    return NextResponse.json({ error: 'Accès refusé (SUPER_ADMIN requis)' }, { status: 403 });
  }
  let body: { deviceId?: string; simNumber?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const { deviceId } = body;
  if (!deviceId) return NextResponse.json({ error: 'deviceId manquant' }, { status: 400 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 });
  const { error } = await sb.from('devices').update({ sim_number: body.simNumber?.trim() || null }).eq('id', deviceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  { const { writeAudit } = await import('@/lib/audit/log'); await writeAudit({ userId: session.id, action: 'UPDATE_SIM', tableName: 'devices', recordId: deviceId }); }
  return NextResponse.json({ ok: true });
}
