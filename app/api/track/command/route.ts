import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canManageGeofences, canConfigureHardware } from '@/lib/auth/permissions';
import { sendDeviceCommand, type TraxbeanCommand } from '@/lib/traxbean/client';

export const dynamic = 'force-dynamic';

const ALLOWED: TraxbeanCommand[] = ['locate'];

// POST /api/track/command — send a remote command to a bracelet.
// Body: { imei, action }. JUDGE or SUPER_ADMIN.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (!canManageGeofences(session.role) && !canConfigureHardware(session.role))) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  let body: { imei?: string; action?: TraxbeanCommand };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const { imei, action } = body;
  if (!imei || !action || !ALLOWED.includes(action)) {
    return NextResponse.json({ error: 'imei / action invalide' }, { status: 400 });
  }
  const ok = await sendDeviceCommand(imei, action);
  if (!ok) return NextResponse.json({ error: 'Commande refusée par la plateforme' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
