import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { canViewDevices, allow } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

const ALERT_SHORT: Record<string, string> = {
  TAMPER_DETECTED: 'Sabotage', PANIC_BUTTON: 'Panique', GEOFENCE_EXIT: 'Sortie zone',
  BLE_EXIT: 'Sortie domicile', CURFEW_VIOLATION: 'Couvre-feu', HEALTH_CRITICAL: 'Santé',
  SIGNAL_LOST: 'Signal', BATTERY_LOW: 'Batterie',
};

// GET /api/devices/live — compact live telemetry for the inventory poller:
// online / battery / signal / last contact / worn / lifecycle + open-alert count.
export async function GET() {
  const session = await getSession();
  if (!session || !allow(session, canViewDevices(session.role), 'hardware')) {
    return NextResponse.json({ devices: [] }, { status: 403 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ devices: [] });

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return NextResponse.json({ devices: [] });

  const { data: devs } = await sb.from('devices').select('*');
  const rows = (devs ?? []) as Record<string, unknown>[];

  const alertMap = new Map<string, { count: number; top: string | null; topSev: number }>();
  const { data: al } = await sb.from('alerts').select('device_id, alert_type, severity').eq('is_resolved', false);
  for (const a of (al ?? []) as { device_id: string | null; alert_type: string; severity: number | null }[]) {
    if (!a.device_id) continue;
    const cur = alertMap.get(a.device_id) ?? { count: 0, top: null, topSev: -1 };
    cur.count += 1;
    if ((a.severity ?? 0) > cur.topSev) { cur.topSev = a.severity ?? 0; cur.top = ALERT_SHORT[a.alert_type] ?? a.alert_type; }
    alertMap.set(a.device_id, cur);
  }

  const devices = rows.map((d) => {
    const id = d.id as string;
    const al = alertMap.get(id);
    return {
      id,
      is_online: Boolean(d.is_online),
      battery: (d.battery_pct as number | null) ?? null,
      signal_dbm: (d.signal_strength_dbm as number | null) ?? null,
      last_seen_at: (d.last_seen_at as string | null) ?? null,
      worn: (d.worn as boolean | null) ?? null,
      lifecycle: (d.lifecycle_status as string | null) ?? (d.case_id ? 'ACTIVE' : 'STOCK'),
      open_alerts: al?.count ?? 0,
      alert_top: al?.top ?? null,
    };
  });

  return NextResponse.json({ devices });
}
