import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware, allow } from '@/lib/auth/permissions';
import { configureDevice, setFallAlarm, setFallSensitivity, setWearingDetection, factoryReset, setServer, type DeviceConfigKind } from '@/lib/traxbean/client';

export const dynamic = 'force-dynamic';

const ALLOWED: DeviceConfigKind[] = ['sos', 'timezoneBF', 'strap', 'apn'];
// Fall / wearing detection (BP40 shortcuts) + lifecycle (reset / server).
const EXTRA = ['fallOn', 'fallOff', 'fallSensitivity', 'wearOn', 'wearOff', 'factoryReset', 'setServer'];

// POST /api/devices/config — device-level protocol configuration.
// Body: { imei, kind, value? }. SUPER_ADMIN / ADMIN with 'hardware'.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'hardware')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  let body: { imei?: string; kind?: string; value?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const { imei, kind, value } = body;
  if (!imei || !kind || (!ALLOWED.includes(kind as DeviceConfigKind) && !EXTRA.includes(kind))) {
    return NextResponse.json({ error: 'imei / kind invalide' }, { status: 400 });
  }

  let ok: boolean;
  switch (kind) {
    case 'fallOn':          ok = await setFallAlarm(imei, true); break;
    case 'fallOff':         ok = await setFallAlarm(imei, false); break;
    case 'fallSensitivity': ok = await setFallSensitivity(imei, Number(value)); break;
    case 'wearOn':          ok = await setWearingDetection(imei, true); break;
    case 'wearOff':         ok = await setWearingDetection(imei, false); break;
    case 'factoryReset':    ok = await factoryReset(imei); break;
    case 'setServer': {
      // value = "host:port" (domain by default). Falls back to the site host.
      const [host, portStr] = (value ?? '').split(':');
      if (!host) { ok = false; break; }
      ok = await setServer(imei, host, Number(portStr) || 8011, true);
      break;
    }
    default:                ok = await configureDevice(imei, kind as DeviceConfigKind, value);
  }
  if (!ok) return NextResponse.json({ error: 'Commande refusée par la plateforme' }, { status: 502 });

  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({ userId: session.id, action: 'CONFIG_DEVICE', tableName: 'devices', recordId: imei, newData: { kind, value } });
  return NextResponse.json({ ok: true });
}
