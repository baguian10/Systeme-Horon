import { NextResponse, type NextRequest } from 'next/server';
import { isTraxbeanConfigured, getDeviceLocation, getLatestBleScan, getWearingStatus, getLatestHealth } from '@/lib/traxbean/client';
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
    .select('id, imei, case_id, battery_pct, is_online, last_seen_at')
    .not('case_id', 'is', null);

  if (!devices || devices.length === 0) {
    return NextResponse.json({ ok: true, polled: 0, note: 'no assigned devices' });
  }

  const settings = await getSettings();
  const origin = request.nextUrl.origin;
  const ingestKey = process.env.INGEST_API_KEY ?? '';

  const staleMin = settings.signal_lost_min ?? 15;

  const results = await Promise.all(
    devices.map(async (device) => {
      const live = await getDeviceLocation(device.imei);
      if (!live) {
        // Device is silent. Mark it offline once and, if it has been silent
        // beyond the configured window, raise SIGNAL_LOST — a truthful
        // connection state instead of a stale "online".
        const wasOnline = device.is_online === true;
        const lastSeen = device.last_seen_at ? Date.parse(device.last_seen_at) : null;
        const silentMin = lastSeen ? (Date.now() - lastSeen) / 60000 : Infinity;
        await supabase.from('devices').update({ is_online: false, sync_status: 'LOST' }).eq('id', device.id);
        if (wasOnline) {
          const { logDeviceEvent } = await import('@/lib/devices/events');
          await logDeviceEvent(supabase, { deviceId: device.id, caseId: device.case_id, type: 'OFFLINE', detail: 'Perte de contact' });
        }
        if (silentMin >= staleMin && device.case_id) {
          await fetch(`${origin}/api/ingest/alert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': ingestKey },
            body: JSON.stringify({ imei: device.imei, type: 'SIGNAL_LOST' }),
          });
        }
        return { imei: device.imei, ok: false, reason: 'no-fix', online: false };
      }

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

      // Sync live telemetry onto the device row (ingest already set is_online +
      // last_seen). Freshness → sync_status: recent fix = SYNCED, lagging = DELAYED.
      const fixAgeMin = (Date.now() - Date.parse(live.recordedAt)) / 60000;
      const syncStatus = fixAgeMin <= 5 ? 'SYNCED' : fixAgeMin <= staleMin ? 'DELAYED' : 'LOST';
      const deviceUpdate: Record<string, unknown> = {
        sync_status: syncStatus,
        last_heartbeat_at: new Date().toISOString(),
      };
      if (live.battery !== null) deviceUpdate.battery_pct = live.battery;
      if (live.signal !== null) deviceUpdate.signal_strength_dbm = live.signal;
      await supabase.from('devices').update(deviceUpdate).eq('id', device.id);

      // ── BLE beacon home alarm: GPS / BLE-proximity / BOTH, with grace ──
      const { data: beacon } = await supabase
        .from('beacons')
        .select('id, uid, min_rssi, alarm_enabled, alarm_mode, max_distance_m, grace_minutes, active_start, active_end, home_lat, home_lng, out_since')
        .eq('device_id', device.id)
        .maybeSingle();

      if (beacon && beacon.alarm_enabled && withinActiveWindow(beacon.active_start, beacon.active_end)) {
        const mode = (beacon.alarm_mode as 'GPS' | 'BLE' | 'BOTH') ?? 'BOTH';
        const minRssi = beacon.min_rssi ?? -85;

        // BLE presence (needed for BLE + BOTH). null = no scan data → unknown.
        let bleInRange: boolean | null = null;
        if (mode === 'BLE' || mode === 'BOTH') {
          const scan = await getLatestBleScan(device.imei);
          if (scan) {
            const hit = scan.sightings.find((s) => s.mac === (beacon.uid ?? '').toUpperCase());
            bleInRange = !!hit && hit.rssi >= minRssi;
          } else {
            // No BLE scan uploaded → the bracelet's BLE module is off. Re-arm it
            // (best effort) so the home alarm doesn't silently stop working.
            const { sendDeviceCommand } = await import('@/lib/traxbean/client');
            await sendDeviceCommand(device.imei, 'enableBle');
          }
        }
        // GPS distance from the recorded home point (needed for GPS + BOTH).
        const gpsFar = (beacon.home_lat != null && beacon.home_lng != null)
          ? haversineM(live.lat, live.lng, beacon.home_lat, beacon.home_lng) > (beacon.max_distance_m ?? 50)
          : null;
        const dist = (beacon.home_lat != null && beacon.home_lng != null)
          ? Math.round(haversineM(live.lat, live.lng, beacon.home_lat, beacon.home_lng)) : null;

        // Decide "away from home" per mode.
        //  BLE  → beacon no longer seen strongly enough (pure proximity, no geofence).
        //  GPS  → outside the home radius.
        //  BOTH → GPS says far AND the beacon isn't in range (indoor-drift safe).
        let away: boolean | null;
        if (mode === 'BLE') away = bleInRange === null ? null : !bleInRange;
        else if (mode === 'GPS') away = gpsFar;
        else away = (gpsFar === true) ? (bleInRange !== true) : false;

        const now = Date.now();
        if (away === true) {
          let outSince = beacon.out_since ? new Date(beacon.out_since).getTime() : null;
          if (!outSince) {
            outSince = now;
            await supabase.from('beacons').update({ out_since: new Date(now).toISOString() }).eq('id', beacon.id);
          }
          const elapsedMin = (now - outSince) / 60000;
          if (elapsedMin >= (beacon.grace_minutes ?? 0)) {
            const { count } = await supabase
              .from('alerts')
              .select('id', { count: 'exact', head: true })
              .eq('case_id', device.case_id)
              .eq('alert_type', 'GEOFENCE_EXIT')
              .eq('is_resolved', false);
            if (!count) {
              const detail = mode === 'BLE'
                ? `Sortie du périmètre domicile (balise BLE hors de portée) depuis ${beacon.grace_minutes} min.`
                : `Éloignement du domicile : ${dist} m (max ${beacon.max_distance_m} m) depuis ${beacon.grace_minutes} min, balise non détectée.`;
              await supabase.from('alerts').insert({
                case_id: device.case_id, device_id: device.id,
                alert_type: 'GEOFENCE_EXIT', severity: 4, description: detail,
                position_lat: live.lat, position_lon: live.lng,
              });
              const { data: kase } = await supabase.from('cases').select('judge_id').eq('id', device.case_id).single();
              if (kase?.judge_id) {
                const { data: ju } = await supabase.from('users').select('phone').eq('id', kase.judge_id).single();
                if (ju?.phone) {
                  const { sendSms } = await import('@/lib/sms');
                  await sendSms(ju.phone, `SIGEP - ALERTE: sortie du domicile detectee. Verifiez la plateforme.`);
                }
              }
            }
          }
        } else if (away === false && beacon.out_since) {
          // Back home → reset the absence timer.
          await supabase.from('beacons').update({ out_since: null }).eq('id', beacon.id);
        }
        // away === null (no BLE data yet) → leave the grace clock untouched.
      }

      // ── Wearing status (anti-removal): APWR flag 0 = bracelet removed → TAMPER ──
      const wearing = await getWearingStatus(device.imei);
      if (wearing && !wearing.worn) {
        const { count } = await supabase
          .from('alerts')
          .select('id', { count: 'exact', head: true })
          .eq('case_id', device.case_id)
          .eq('alert_type', 'TAMPER_DETECTED')
          .eq('is_resolved', false);
        if (!count) {
          await supabase.from('alerts').insert({
            case_id: device.case_id, device_id: device.id,
            alert_type: 'TAMPER_DETECTED', severity: 5,
            description: 'Bracelet retiré du corps (détection de port).',
            position_lat: live.lat, position_lon: live.lng,
          });
          await supabase.from('cases').update({ status: 'VIOLATION', updated_at: new Date().toISOString() }).eq('id', device.case_id);
          const { data: kase } = await supabase.from('cases').select('judge_id').eq('id', device.case_id).single();
          if (kase?.judge_id) {
            const { data: ju } = await supabase.from('users').select('phone').eq('id', kase.judge_id).single();
            if (ju?.phone) { const { sendSms } = await import('@/lib/sms'); await sendSms(ju.phone, 'SIGEP - ALERTE: bracelet retire du corps. Verifiez la plateforme.'); }
          }
        }
      }

      // ── Health monitoring (APJK): critical vitals → HEALTH_CRITICAL ──
      const health = await getLatestHealth(device.imei);
      if (health) {
        let critical: string | null = null;
        const v = parseFloat(health.value);
        if (health.type === 'BODY_TEMP' && !Number.isNaN(v) && (v < 35 || v > 39)) critical = `Température corporelle anormale : ${v} °C.`;
        else if (health.type === 'HEART_RATE' && !Number.isNaN(v) && (v < 40 || v > 130)) critical = `Fréquence cardiaque anormale : ${v} bpm.`;
        else if (health.type === 'BLOOD_OXYGEN' && !Number.isNaN(v) && v < 90) critical = `Saturation en oxygène basse : ${v} %.`;
        if (critical) {
          const { count } = await supabase.from('alerts').select('id', { count: 'exact', head: true })
            .eq('case_id', device.case_id).eq('alert_type', 'HEALTH_CRITICAL').eq('is_resolved', false);
          if (!count) {
            await supabase.from('alerts').insert({
              case_id: device.case_id, device_id: device.id,
              alert_type: 'HEALTH_CRITICAL', severity: 4, description: critical,
              position_lat: live.lat, position_lon: live.lng,
            });
            const { data: kase } = await supabase.from('cases').select('judge_id').eq('id', device.case_id).single();
            if (kase?.judge_id) {
              const { data: ju } = await supabase.from('users').select('phone').eq('id', kase.judge_id).single();
              if (ju?.phone) { const { sendSms } = await import('@/lib/sms'); await sendSms(ju.phone, 'SIGEP - ALERTE SANTE: constante vitale critique du porteur. Verifiez la plateforme.'); }
            }
          }
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
