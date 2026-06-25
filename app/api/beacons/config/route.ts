import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canConfigureHardware, canManageGeofences } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// POST /api/beacons/config — set a beacon's activatable options.
// Body: { beaconId, alarmEnabled, maxDistanceM, graceMinutes, notifyExit, activeStart, activeEnd }
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (!canConfigureHardware(session.role) && !canManageGeofences(session.role))) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }
  let b: {
    beaconId?: string; alarmEnabled?: boolean; maxDistanceM?: number;
    graceMinutes?: number; notifyExit?: boolean; activeStart?: string | null; activeEnd?: string | null;
  };
  try { b = await request.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  if (!b.beaconId) return NextResponse.json({ error: 'beaconId manquant' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (b.alarmEnabled !== undefined) update.alarm_enabled = Boolean(b.alarmEnabled);
  if (b.notifyExit !== undefined) update.notify_exit = Boolean(b.notifyExit);
  if (b.maxDistanceM !== undefined) update.max_distance_m = Math.max(5, Math.min(5000, Math.round(Number(b.maxDistanceM) || 50)));
  if (b.graceMinutes !== undefined) update.grace_minutes = Math.max(0, Math.min(120, Math.round(Number(b.graceMinutes) || 0)));
  if (b.activeStart !== undefined) update.active_start = b.activeStart || null;
  if (b.activeEnd !== undefined) update.active_end = b.activeEnd || null;

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ error: 'DB indisponible' }, { status: 503 });
  const { error } = await sb.from('beacons').update(update).eq('id', b.beaconId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
