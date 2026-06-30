import { NextResponse, type NextRequest } from 'next/server';
import { isTraxbeanConfigured, getDeviceLocation, getLatestBleScan } from '@/lib/traxbean/client';
import { getSettings } from '@/lib/settings';

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
const SIGNAL_LOW = 10;

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function toMin(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Is the beacon's alarm schedule active now? (UTC; Burkina Faso = GMT+0)
function withinActiveWindow(start: string | null, end: string | null): boolean {
  const s = toMin(start), e = toMin(end);
  if (s == null || e == null) return true; // no schedule = always active
  const now = new Date();
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
  return s <= e ? cur >= s && cur < e : cur >= s || cur < e;
}

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

  const settings = await getSettings();
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

      // ── BLE beacon home alarm: distance + grace period enforcement ──
      const { data: beacon } = await supabase
        .from('beacons')
        .select('id, uid, min_rssi, alarm_enabled, max_distance_m, grace_minutes, active_start, active_end, home_lat, home_lng, out_since')
        .eq('device_id', device.id)
        .maybeSingle();

      if (beacon && beacon.alarm_enabled && beacon.home_lat != null && beacon.home_lng != null
          && withinActiveWindow(beacon.active_start, beacon.active_end)) {
        const dist = haversineM(live.lat, live.lng, beacon.home_lat, beacon.home_lng);
        if (dist > (beacon.max_distance_m ?? 50)) {
          const now = Date.now();
          let outSince = beacon.out_since ? new Date(beacon.out_since).getTime() : null;
          if (!outSince) {
            outSince = now;
            await supabase.from('beacons').update({ out_since: new Date(now).toISOString() }).eq('id', beacon.id);
          }
          const elapsedMin = (now - outSince) / 60000;
          if (elapsedMin >= (beacon.grace_minutes ?? 0)) {
            // Combined logic: GPS says "far", but if the home BLE beacon is still
            // detected ABOVE the RSSI threshold, the person is actually home
            // (indoor GPS drift) → suppress. A weak/absent beacon signal = away.
            const scan = await getLatestBleScan(device.imei);
            const hit = scan?.sightings.find((s) => s.mac === (beacon.uid ?? '').toUpperCase());
            const atHome = !!hit && hit.rssi >= (beacon.min_rssi ?? -85);
            if (atHome) {
              await supabase.from('beacons').update({ out_since: null }).eq('id', beacon.id);
            } else {
              const { count } = await supabase
                .from('alerts')
                .select('id', { count: 'exact', head: true })
                .eq('case_id', device.case_id)
                .eq('alert_type', 'GEOFENCE_EXIT')
                .eq('is_resolved', false);
              if (!count) {
                await supabase.from('alerts').insert({
                  case_id: device.case_id,
                  device_id: device.id,
                  alert_type: 'GEOFENCE_EXIT',
                  severity: 4,
                  description: `Éloignement du domicile : ${Math.round(dist)} m (max ${beacon.max_distance_m} m) depuis ${beacon.grace_minutes} min, beacon non détecté.`,
                  position_lat: live.lat,
                  position_lon: live.lng,
                });
                // Notify the responsible judge by SMS (if configured + phone set).
                const { data: kase } = await supabase.from('cases').select('judge_id').eq('id', device.case_id).single();
                if (kase?.judge_id) {
                  const { data: ju } = await supabase.from('users').select('phone').eq('id', kase.judge_id).single();
                  if (ju?.phone) {
                    const { sendSms } = await import('@/lib/sms');
                    await sendSms(ju.phone, `SIGEP - ALERTE: eloignement du domicile detecte (${Math.round(dist)} m). Verifiez la plateforme.`);
                  }
                }
              }
            }
          }
        } else if (beacon.out_since) {
          // Back within range → reset the absence timer.
          await supabase.from('beacons').update({ out_since: null }).eq('id', beacon.id);
        }
      }

      // Health alerts (deduped by the alert ingest? — keep simple: emit on threshold)
      const alerts: { type: string }[] = [];
      if (live.battery !== null && live.battery <= settings.battery_alert_pct) {
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
