import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware, allow } from '@/lib/auth/permissions';
import { isTraxbeanConfigured, probeVolumeCommands } from '@/lib/traxbean/client';

export const dynamic = 'force-dynamic';
// Le sondage attend 12 s la réponse du bracelet, plus les envois : marge large.
export const maxDuration = 60;

// POST /api/devices/volume — sonde les commandes de volume non documentées.
// Body: { imei, level }  (level 1–9, 9 = maximum). SUPER_ADMIN / ADMIN matériel.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !allow(session, canConfigureHardware(session.role), 'hardware')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  if (!isTraxbeanConfigured()) {
    return NextResponse.json({ error: 'Plateforme Traxbean non configurée' }, { status: 503 });
  }

  let body: { imei?: string; level?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const { imei } = body;
  if (!imei) return NextResponse.json({ error: 'imei requis' }, { status: 400 });
  const level = Math.max(1, Math.min(9, Math.round(Number(body.level) || 9)));

  const probes = await probeVolumeCommands(imei, level);
  if (probes.length === 0) {
    return NextResponse.json({ error: 'Bracelet introuvable sur la plateforme' }, { status: 502 });
  }

  const accepted = probes.filter((p) => p.reply);
  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({
    userId: session.id, action: 'PROBE_VOLUME', tableName: 'devices', recordId: imei,
    newData: { level, tested: probes.length, answered: accepted.map((p) => p.command) },
  });

  return NextResponse.json({ ok: true, level, probes, answered: accepted.length });
}
