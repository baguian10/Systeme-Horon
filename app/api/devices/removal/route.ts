import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware, allow } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// POST /api/devices/removal — ouvrir ou annuler une fenêtre de retrait autorisé.
// Body: { imei, minutes?, reason? }  ·  { imei, cancel: true }
//
// Pendant la fenêtre, l'ouverture de la sangle est enregistrée sans lever
// d'alerte de sabotage. Au-delà, le comportement normal reprend — la fenêtre
// périme d'elle-même, il n'y a pas de garde à lever manuellement.
const MAX_MINUTES = 240;

const REASONS = [
  'Fin de mesure',
  'Maintenance du matériel',
  'Soins médicaux',
  'Décision judiciaire',
  'Remplacement du bracelet',
];

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'hardware')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  let body: { imei?: string; minutes?: number; reason?: string; cancel?: boolean };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const imei = body.imei?.trim();
  if (!imei) return NextResponse.json({ error: 'imei requis' }, { status: 400 });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'Base indisponible' }, { status: 503 });

  const { data: dev } = await sb.from('devices').select('id, case_id').eq('imei', imei).maybeSingle();
  const device = dev as { id: string; case_id: string | null } | null;
  if (!device) return NextResponse.json({ error: 'Bracelet inconnu' }, { status: 404 });

  const { logDeviceEvent } = await import('@/lib/devices/events');
  const { writeAudit } = await import('@/lib/audit/log');

  if (body.cancel) {
    const { error } = await sb.from('devices')
      .update({ removal_allowed_until: null, removal_reason: null, removal_by: null })
      .eq('id', device.id);
    if (error) return NextResponse.json({ error: 'Colonnes de retrait absentes — migration non appliquée' }, { status: 503 });
    await logDeviceEvent(sb, { deviceId: device.id, caseId: device.case_id, actorId: session.id, type: 'COMMAND', detail: 'Autorisation de retrait annulée' });
    await writeAudit({ userId: session.id, action: 'REMOVAL_CANCEL', tableName: 'devices', recordId: device.id });
    return NextResponse.json({ ok: true, until: null });
  }

  const minutes = Math.max(5, Math.min(MAX_MINUTES, Math.round(Number(body.minutes) || 30)));
  const reason = REASONS.includes(body.reason ?? '') ? body.reason! : (body.reason?.trim() || 'Non précisé');
  const until = new Date(Date.now() + minutes * 60000).toISOString();

  const { error } = await sb.from('devices')
    .update({ removal_allowed_until: until, removal_reason: reason, removal_by: session.id })
    .eq('id', device.id);
  if (error) return NextResponse.json({ error: 'Colonnes de retrait absentes — migration non appliquée' }, { status: 503 });

  await logDeviceEvent(sb, {
    deviceId: device.id, caseId: device.case_id, actorId: session.id, type: 'COMMAND',
    detail: `Retrait autorisé ${minutes} min — ${reason}`,
  });
  await writeAudit({
    userId: session.id, action: 'REMOVAL_ALLOW', tableName: 'devices', recordId: device.id,
    newData: { minutes, reason, until },
  });

  return NextResponse.json({ ok: true, until, reason, minutes });
}
