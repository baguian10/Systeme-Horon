import { NextResponse, type NextRequest } from 'next/server';
import { isTraxbeanConfigured, getDeviceLocation } from '@/lib/traxbean/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/cron/poll-traxbean
// Polls the Traxbean platform for every registered device, then feeds each
// fresh position through the standard ingest pipeline (geofence + alert checks).
//
// Vercel Hobby cron only fires once per day, so for real-time tracking trigger
// this route from a free external pinger (e.g. cron-job.org) every minute:
//   https://<site>/api/cron/poll-traxbean?secret=<CRON_SECRET>
//
// Battery and signal thresholds raise BATTERY_LOW / SIGNAL_LOST alerts.
const BATTERY_LOW_PCT = 15;
const SIGNAL_LOW = 10;

export async function GET(request: NextRequest) {
  // Auth — accept ?secret= or Authorization: Bearer <secret>
  const cronSecret = process.env.CRON_SECRET;
  const provided =
    request.nextUrl.searchParams.get('secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (cronSecret && provided !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isTraxbeanConfigured()) {
    return NextResponse.json({ error: 'TRAXBEAN_TOKEN not configured' }, { status: 503 });
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });
  }

  // Only poll devices assigned to a case (positions require a case_id).
  const { data: devices } = await supabase
    .from('devices')
    .select('id, imei, case_id, battery_pct')
    .not('case_id', 'is', null);

  if (!devices || devices.length === 0) {
    return NextResponse.json({ ok: true, polled: 0, note: 'no assigned devices' });
  }

  const origin = request.nextUrl.origin;
  const ingestKey = process.env.INGEST_API_KEY ?? '';

  const results = await Promise.all(
    devices.map(async (device) => {
      const live = await getDeviceLocation(device.imei);
      if (!live) return { imei: device.imei, ok: false, reason: 'no-fix' };

      // Position → standard ingest (handles geofence + GEOFENCE_EXIT alert)
      await fetch(`${origin}/api/ingest/position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': ingestKey },
        body: JSON.stringify({
          imei: device.imei,
          lat: live.lat,
          lon: live.lng,
          speed_kmh: live.speedKmh ?? undefined,
          timestamp: live.recordedAt,
        }),
      });

      // Sync battery onto the device row
      if (live.battery !== null) {
        await supabase
          .from('devices')
          .update({ battery_pct: live.battery })
          .eq('id', device.id);
      }

      // Health alerts (deduped by the alert ingest? — keep simple: emit on threshold)
      const alerts: { type: string }[] = [];
      if (live.battery !== null && live.battery <= BATTERY_LOW_PCT) {
        alerts.push({ type: 'BATTERY_LOW' });
      }
      if (live.signal !== null && live.signal <= SIGNAL_LOW) {
        alerts.push({ type: 'SIGNAL_LOST' });
      }
      for (const a of alerts) {
        await fetch(`${origin}/api/ingest/alert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ingestKey },
          body: JSON.stringify({
            imei: device.imei,
            type: a.type,
            lat: live.lat,
            lon: live.lng,
          }),
        });
      }

      return { imei: device.imei, ok: true, battery: live.battery, alerts: alerts.length };
    })
  );

  return NextResponse.json({ ok: true, polled: results.length, results });
}
