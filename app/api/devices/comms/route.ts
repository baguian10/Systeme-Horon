import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware, allow } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// POST /api/devices/comms — configure TR40 voice communication.
// Body: { deviceId, imei, sosNumbers[], whitelist[{name,phone}], callEnabled }
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'commands')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  let body: {
    deviceId?: string; imei?: string;
    sosNumbers?: string[]; whitelist?: { name: string; phone: string }[]; callEnabled?: boolean;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const { deviceId, imei } = body;
  if (!deviceId || !imei) return NextResponse.json({ error: 'deviceId / imei requis' }, { status: 400 });

  const sosNumbers = (body.sosNumbers ?? []).map((s) => s.trim()).filter(Boolean);
  const whitelist = (body.whitelist ?? []).filter((c) => c.phone?.trim());
  const callEnabled = body.callEnabled !== false;

  // Push to the bracelet (best effort — persist config even if the device is offline).
  const { setSosNumbers, setWhitelist, setPhoneCallSwitch } = await import('@/lib/traxbean/client');
  const results = { sos: false, whitelist: false, call: false };
  try { results.sos = await setSosNumbers(imei, sosNumbers); } catch {}
  try { results.whitelist = await setWhitelist(imei, whitelist); } catch {}
  try { results.call = await setPhoneCallSwitch(imei, callEnabled); } catch {}

  // Persist.
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (sb) {
    await sb.from('devices').update({
      sos_numbers: sosNumbers,
      call_whitelist: whitelist,
      call_enabled: callEnabled,
    }).eq('id', deviceId);
    const { writeAudit } = await import('@/lib/audit/log');
    await writeAudit({ userId: session.id, action: 'CONFIG_COMMS', tableName: 'devices', recordId: deviceId, newData: { sos: sosNumbers.length, whitelist: whitelist.length, callEnabled } });
    const { logDeviceEvent } = await import('@/lib/devices/events');
    await logDeviceEvent(sb, { deviceId, actorId: session.id, type: 'COMMAND', detail: `Communication: ${sosNumbers.length} SOS, ${whitelist.length} autorisés, appels ${callEnabled ? 'ON' : 'OFF'}` });
  }

  const delivered = results.sos || results.whitelist || results.call;
  return NextResponse.json({ ok: true, delivered, results });
}
