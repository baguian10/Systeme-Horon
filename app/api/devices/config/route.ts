import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware, allow } from '@/lib/auth/permissions';
import { configureDevice, type DeviceConfigKind } from '@/lib/traxbean/client';

export const dynamic = 'force-dynamic';

const ALLOWED: DeviceConfigKind[] = ['sos', 'timezoneBF', 'strap', 'apn'];

// POST /api/devices/config — device-level protocol configuration.
// Body: { imei, kind, value? }. SUPER_ADMIN / ADMIN with 'hardware'.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'hardware')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  let body: { imei?: string; kind?: DeviceConfigKind; value?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const { imei, kind, value } = body;
  if (!imei || !kind || !ALLOWED.includes(kind)) {
    return NextResponse.json({ error: 'imei / kind invalide' }, { status: 400 });
  }
  const ok = await configureDevice(imei, kind, value);
  if (!ok) return NextResponse.json({ error: 'Commande refusée par la plateforme' }, { status: 502 });

  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'CONFIG_DEVICE', tableName: 'devices', recordId: imei, newData: { kind, value } });
  return NextResponse.json({ ok: true });
}
