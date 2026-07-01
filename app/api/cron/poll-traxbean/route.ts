import { NextResponse, type NextRequest } from 'next/server';
import { isTraxbeanConfigured, getDeviceLocation, getLatestBleScan, getWearingStatus, getDeviceWearStatus, getLatestHealth, checkTraxbeanAuth } from '@/lib/traxbean/client';
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

  // ── Auth health-check: an expired TRAXBEAN_TOKEN silently kills all tracking.
  // Record the state and alert the super admins (deduped) when it goes bad. ──
  const auth = await checkTraxbeanAuth();
  await supabase.from('system_settings').update({
    traxbean_auth_ok: auth === 'ok',
    traxbean_auth_checked_at: new Date().toISOString(),
  }).eq('id', 1);
  if (auth !== 'ok') {
    const { data: st } = await supabase.from('system_settings').select('traxbean_auth_alerted_at').eq('id', 1).maybeSingle();
    const lastAlert = (st as { traxbean_auth_alerted_at?: string | null } | null)?.traxbean_auth_alerted_at;
    const dueForAlert = !lastAlert || (Date.now() - Date.parse(lastAlert)) > 6 * 3600_000;
    if (dueForAlert && auth !== 'unconfigured') {
      const { data: admins } = await supabase.from('users').select('phone').eq('role', 'SUPER_ADMIN').eq('is_active', true);
      const { sendSms } = await import('@/lib/sms');
      for (const a of (admins ?? []) as { phone: string | null }[]) {
        if (a.phone) await sendSms(a.phone, `SIGEP - CRITIQUE: lien plateforme GPS (Traxbean) ${auth === 'expired' ? 'expire' : 'injoignable'}. Le suivi des bracelets est interrompu. Renouvelez le token.`);
      }
      await supabase.from('system_settings').update({ traxbean_auth_alerted_at: new Date().toISOString() }).eq('id', 1);
    }
    // Nothing more to poll while auth is down.
    return NextResponse.json({ ok: false, auth, note: 'Traxbean auth not OK — tracking paused' }, { status: 200 });
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

      // ── Live BLE presence: record whether the tracker currently sees this
      // beacon (independent of the alarm logic below), so the UI shows a
      // truthful "BLE connecté / absent" status with the real RSSI. ──
      if (beacon?.uid) {
        const presenceScan = await getLatestBleScan(device.imei);
        if (presenceScan) {
          const hit = presenceScan.sightings.find((s) => s.mac === (beacon.uid ?? '').toUpperCase());
          await supabase.from('beacons').update({
            ble_present: !!hit,
            ble_rssi: hit ? hit.rssi : null,
            ble_checked_at: new Date().toISOString(),
          }).eq('id', beacon.id);
        } else {
          // No fresh scan → status unknown (don't fake a connection).
          await supabase.from('beacons').update({ ble_present: null, ble_checked_at: new Date().toISOString() }).eq('id', beacon.id);
        }
      }

      // If the case also has a GPS inclusion zone, the geofence enforcer
      // (ingest/position) already cross-checks this beacon and raises the exit —
      // skip the standalone beacon alarm to avoid a duplicate.
      const { count: inclusionZones } = await supabase
        .from('geofences')
        .select('id', { count: 'exact', head: true })
        .eq('case_id', device.case_id)
        .eq('is_exclusion', false)
        .is('active_start', null);

      if (beacon && beacon.alarm_enabled && !inclusionZones && withinActiveWindow(beacon.active_start, beacon.active_end)) {
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

        // Motion gate: a real home exit means the person WALKED out. When the
        // subject is asleep/still, a worn bracelet goes to sleep and drops the
        // BLE scan → the beacon looks "absent". Without motion we must NOT raise
        // an exit (that would false-alarm every night). So a BLE absence only
        // STARTS the grace clock if there's movement; once started it keeps
        // running even if they then stop.
        const MOTION_KMH = 2;
        const moving = live.speedKmh != null && live.speedKmh >= MOTION_KMH;

        // Decide "away from home" per mode.
        //  BLE  → beacon not seen; confirmed as an exit only with motion (or an
        //         already-running grace clock). Still + no clock → unknown (asleep).
        //  GPS  → outside the home radius.
        //  BOTH → GPS says far AND the beacon isn't in range (indoor-drift safe).
        let away: boolean | null;
        if (mode === 'BLE') {
          if (bleInRange === null) away = null;
          else if (bleInRange) away = false;
          else away = (moving || beacon.out_since) ? true : null;
        }
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
            // BLE mode raises the distinct BLE_EXIT type so it never dedupes
            // against a GPS geofence exit; GPS/BOTH keep GEOFENCE_EXIT.
            const alertType = mode === 'BLE' ? 'BLE_EXIT' : 'GEOFENCE_EXIT';
            const { count } = await supabase
              .from('alerts')
              .select('id', { count: 'exact', head: true })
              .eq('case_id', device.case_id)
              .eq('alert_type', alertType)
              .eq('is_resolved', false);
            if (!count) {
              const detail = mode === 'BLE'
                ? `Sortie du périmètre domicile (balise BLE hors de portée) depuis ${beacon.grace_minutes} min.`
                : `Éloignement du domicile : ${dist} m (max ${beacon.max_distance_m} m) depuis ${beacon.grace_minutes} min, balise non détectée.`;
              await supabase.from('alerts').insert({
                case_id: device.case_id, device_id: device.id,
                alert_type: alertType, severity: 4, description: detail,
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

      // ── Wearing status (anti-removal) → persist + TAMPER on removal ──
      // Primary source: the platform target `wear` field (1 worn / 0 removed /
      // null unknown); fall back to APWR in the log if unknown.
      let worn = await getDeviceWearStatus(device.imei);
      if (worn === null) {
        const wr = await getWearingStatus(device.imei);
        worn = wr ? wr.worn : null;
      }
      await supabase.from('devices').update({ worn, worn_checked_at: new Date().toISOString() }).eq('id', device.id);
      if (worn === false) {
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
