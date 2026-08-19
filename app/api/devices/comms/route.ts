import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware, allow } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// POST /api/devices/comms — configure TR40 voice communication.
// Body: { deviceId, imei, sosNumbers?[], whitelist?[{name,phone}], callEnabled?, whitelistOnly? }
//
// Chaque champ est facultatif : absent = inchangé. C'était l'inverse avant, et
// un panneau qui ne gérait que la liste blanche effaçait au passage les numéros
// SOS du bracelet (setSosNumbers recevait un tableau vide).
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'commands')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  let body: {
    deviceId?: string; imei?: string;
    sosNumbers?: string[]; whitelist?: { name: string; phone: string }[];
    callEnabled?: boolean; whitelistOnly?: boolean;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const { deviceId, imei } = body;
  if (!deviceId || !imei) return NextResponse.json({ error: 'deviceId / imei requis' }, { status: 400 });

  const sosNumbers = body.sosNumbers ? body.sosNumbers.map((s) => s.trim()).filter(Boolean) : undefined;
  const whitelist = body.whitelist ? body.whitelist.filter((c) => c.phone?.trim()) : undefined;
  const callEnabled = typeof body.callEnabled === 'boolean' ? body.callEnabled : undefined;
  const whitelistOnly = typeof body.whitelistOnly === 'boolean' ? body.whitelistOnly : undefined;

  // Push to the bracelet (best effort — persist config even if the device is offline).
  const { setSosNumbers, setWhitelist, setPhoneCallSwitch, setWhitelistSwitch } = await import('@/lib/traxbean/client');
  const results: Record<string, boolean> = {};
  if (sosNumbers)   { try { results.sos = await setSosNumbers(imei, sosNumbers); } catch { results.sos = false; } }
  if (whitelist)    { try { results.whitelist = await setWhitelist(imei, whitelist); } catch { results.whitelist = false; } }
  if (callEnabled !== undefined)   { try { results.call = await setPhoneCallSwitch(imei, callEnabled); } catch { results.call = false; } }
  // L'interrupteur part APRÈS la liste : ouvrir le filtre avant d'avoir écrit
  // les numéros couperait le bracelet de tout appel entre les deux commandes.
  if (whitelistOnly !== undefined) { try { results.whitelistOnly = await setWhitelistSwitch(imei, whitelistOnly); } catch { results.whitelistOnly = false; } }

  // Persist.
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (sb) {
    const update: Record<string, unknown> = {};
    if (sosNumbers) update.sos_numbers = sosNumbers;
    if (whitelist) update.call_whitelist = whitelist;
    if (callEnabled !== undefined) update.call_enabled = callEnabled;
    if (whitelistOnly !== undefined) update.call_whitelist_only = whitelistOnly;

    if (Object.keys(update).length > 0) {
      const { error } = await sb.from('devices').update(update).eq('id', deviceId);
      // La colonne call_whitelist_only arrive par migration : tant qu'elle n'est
      // pas appliquée, on enregistre le reste plutôt que de tout perdre.
      if (error && 'call_whitelist_only' in update) {
        delete update.call_whitelist_only;
        if (Object.keys(update).length > 0) await sb.from('devices').update(update).eq('id', deviceId);
      }
    }

    const detail = [
      sosNumbers && `${sosNumbers.length} SOS`,
      whitelist && `${whitelist.length} autorisés`,
      callEnabled !== undefined && `appels ${callEnabled ? 'ON' : 'OFF'}`,
      whitelistOnly !== undefined && `filtre liste blanche ${whitelistOnly ? 'ON' : 'OFF'}`,
    ].filter(Boolean).join(', ');
    const { writeAudit } = await import('@/lib/audit/log');
    await writeAudit({ userId: session.id, action: 'CONFIG_COMMS', tableName: 'devices', recordId: deviceId, newData: { detail } });
    const { logDeviceEvent } = await import('@/lib/devices/events');
    await logDeviceEvent(sb, { deviceId, actorId: session.id, type: 'COMMAND', detail: `Communication: ${detail}` });
  }

  const delivered = Object.values(results).some(Boolean);
  return NextResponse.json({ ok: true, delivered, results });
}
