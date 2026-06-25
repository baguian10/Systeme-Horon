import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canManageGeofences, canConfigureHardware , allow } from '@/lib/auth/permissions';
import { sendDeviceCommand, type TraxbeanCommand } from '@/lib/traxbean/client';

export const dynamic = 'force-dynamic';

const SAFE: TraxbeanCommand[] = ['locate', 'enableBle', 'restart', 'setInterval', 'realtime'];
const ADMIN_ONLY: TraxbeanCommand[] = ['shutdown'];

// POST /api/track/command — send a remote command to a bracelet.
// Body: { imei, action, value? }. Safe commands: JUDGE/SUPER_ADMIN.
// Sensitive (shutdown): SUPER_ADMIN only.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { imei?: string; action?: TraxbeanCommand; value?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const { imei, action, value } = body;
  if (!imei || !action) return NextResponse.json({ error: 'imei / action manquant' }, { status: 400 });

  if (ADMIN_ONLY.includes(action)) {
    if (!allow(session, canConfigureHardware(session.role), 'commands.shutdown')) {
      return NextResponse.json({ error: 'Réservé SUPER_ADMIN' }, { status: 403 });
    }
  } else if (SAFE.includes(action)) {
    if (!allow(session, canConfigureHardware(session.role), 'commands')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  }

  const ok = await sendDeviceCommand(imei, action, value);
  if (!ok) return NextResponse.json({ error: 'Commande refusée par la plateforme' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
