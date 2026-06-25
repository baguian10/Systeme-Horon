import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware , allow } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// POST /api/devices/create — register a new bracelet into stock. SUPER_ADMIN.
// Body: { imei, model?, simNumber? }
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'hardware')) {
    return NextResponse.json({ error: 'Accès refusé (SUPER_ADMIN requis)' }, { status: 403 });
  }
  let body: { imei?: string; model?: string; simNumber?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const imei = body.imei?.trim();
  if (!imei) return NextResponse.json({ error: 'IMEI requis' }, { status: 400 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 });
  const { error } = await sb.from('devices').insert({
    imei,
    model: body.model?.trim() || 'Traxbean TR40',
    sim_number: body.simNumber?.trim() || null,
    battery_pct: 100,
    is_online: false,
    case_id: null,
  });
  if (error) return NextResponse.json({ error: /duplicate|unique/i.test(error.message) ? 'IMEI déjà existant' : error.message }, { status: 500 });
  { const { writeAudit } = await import('@/lib/audit/log'); await writeAudit({ userId: session.id, action: 'CREATE_DEVICE', tableName: 'devices', recordId: undefined, newData: { imei } }); }
  return NextResponse.json({ ok: true });
}
