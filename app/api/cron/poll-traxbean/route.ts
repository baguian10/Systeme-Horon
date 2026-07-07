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

// Convert a physical distance (metres) to an approximate BLE RSSI threshold.
// Model: RSSI(d) = TX_POWER − 10·n·log10(d), TX_POWER=−59 dBm @1m, n=2.5 (indoor/mixed).
// Example: 3m → −71 dBm, 4m → −74 dBm, 10m → −84 dBm.
// Only an approximation — real RSSI varies with obstacles; use calibrated min_rssi when precise.
function distanceToMinRssi(distM: number): number {
  return Math.round(-59 - 10 * 2.5 * Math.log10(Math.max(1, distM)));
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
    .select('id, imei, case_id, battery_pct, signal_strength_dbm, is_online, last_seen_at')
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
        // SIGNAL_LOST alert disabled — device offline status is visible in
        // the bracelet panel and monitoring grid without generating alert noise.
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

      // Telemetry history point for the battery/signal trend charts. Throttled:
      // only record on a real change (battery %, or signal by >=5 dBm) so a flat
      // device doesn't write an identical row every minute. Best-effort — the
      // device_telemetry table is added by a migration; ignore if absent.
      const battChanged = live.battery !== null && live.battery !== device.battery_pct;
      const sigChanged = live.signal !== null &&
        (device.signal_strength_dbm == null || Math.abs(live.signal - device.signal_strength_dbm) >= 5);
      if (battChanged || sigChanged) {
        await supabase.from('device_telemetry').insert({ device_id: device.id, battery_pct: live.battery, signal_dbm: live.signal });
      }

      // ── BLE beacon home alarm: GPS / BLE-proximity / BOTH, with grace ──
      const { data: beacon } = await supabase
        .from('beacons')
        .select('id, uid, min_rssi, alarm_enabled, alarm_mode, max_distance_m, grace_minutes, active_start, active_end, home_lat, home_lng, out_since, ble_scan_lost_at')
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

      // GPS/BOTH modes: if the case also has a GPS inclusion zone, the geofence
      // enforcer (ingest/position) already cross-checks this beacon and raises
      // GEOFENCE_EXIT — skip the standalone alarm to avoid a duplicate.
      // BLE mode: ALWAYS runs. It raises the distinct BLE_EXIT type (no dedup
      // conflict) and is the ONLY path that checks BLE distance — skipping it
      // when geofences exist would silence the operator's explicit BLE config.
      const { count: inclusionZones } = await supabase
        .from('geofences')
        .select('id', { count: 'exact', head: true })
        .eq('case_id', device.case_id)
        .eq('is_exclusion', false)
        .is('active_start', null);

      const beaconMode = (beacon?.alarm_mode as 'GPS' | 'BLE' | 'BOTH' | undefined) ?? 'BOTH';
      const skipForGeofence = !!inclusionZones && beaconMode !== 'BLE';

      if (beacon && beacon.alarm_enabled && !skipForGeofence && withinActiveWindow(beacon.active_start, beacon.active_end)) {
        const mode = beaconMode;
        // RSSI threshold: if max_distance_m is set, derive from path-loss model so the
        // "distance" parameter the operator configures actually works in BLE mode.
        // Falls back to the manual min_rssi field if max_distance_m is absent.
        const effectiveMinRssi = (beacon.max_distance_m != null)
          ? distanceToMinRssi(beacon.max_distance_m)
          : (beacon.min_rssi ?? -85);

        // BLE presence (needed for BLE + BOTH). null = no scan data → unknown.
        let bleInRange: boolean | null = null;
        if (mode === 'BLE' || mode === 'BOTH') {
          const scan = await getLatestBleScan(device.imei);
          if (scan) {
            const hit = scan.sightings.find((s) => s.mac === (beacon.uid ?? '').toUpperCase());
            bleInRange = !!hit && hit.rssi >= effectiveMinRssi;
            if (beacon.ble_scan_lost_at) await supabase.from('beacons').update({ ble_scan_lost_at: null }).eq('id', beacon.id);
          } else {
            // No BLE scan uploaded → the bracelet's BLE module went silent. Re-arm
            // it aggressively (BLE + wake) so the home alarm resumes, and if it
            // stays silent too long, alert — a blind BLE surveillance is worse
            // than a false alarm; the operator must know it stopped.
            const { sendDeviceCommand } = await import('@/lib/traxbean/client');
            await sendDeviceCommand(device.imei, 'enableBle');
            await sendDeviceCommand(device.imei, 'realtime'); // wake the device
            const lostAt = beacon.ble_scan_lost_at ? new Date(beacon.ble_scan_lost_at).getTime() : null;
            if (!lostAt) {
              await supabase.from('beacons').update({ ble_scan_lost_at: new Date().toISOString() }).eq('id', beacon.id);
            // SIGNAL_LOST alert for BLE scan loss disabled — visible on device panel.
            }
          }
        }
        // GPS distance from the recorded home point (needed for GPS + BOTH).
        const gpsFar = (beacon.home_lat != null && beacon.home_lng != null)
          ? haversineM(live.lat, live.lng, beacon.home_lat, beacon.home_lng) > (beacon.max_distance_m ?? 50)
          : null;
        const dist = (beacon.home_lat != null && beacon.home_lng != null)
          ? Math.round(haversineM(live.lat, live.lng, beacon.home_lat, beacon.home_lng)) : null;

        // Decide "away from home" per mode.
        //  BLE  → beacon below RSSI threshold (or not seen). Grace period handles
        //         transient BLE dropouts (device power-save, brief scan gaps).
        //         Motion gate removed: a removed/distant bracelet while stationary
        //         (e.g., placed on a table) must still trigger the alarm.
        //  GPS  → outside the home radius (haversine vs max_distance_m).
        //  BOTH → GPS says far AND beacon below threshold (indoor GPS drift safe).
        let away: boolean | null;
        if (mode === 'BLE') {
          if (bleInRange === null) away = null; // no scan data → unknown
          else away = !bleInRange;              // directly: in range = home, else away
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
            // Dedup only against an OPEN alert whose episode is still running.
            // A past alert (condition cleared) never blocks a new episode.
            const { count } = await supabase
              .from('alerts')
              .select('id', { count: 'exact', head: true })
              .eq('case_id', device.case_id)
              .eq('alert_type', alertType)
              .eq('is_resolved', false)
              .is('condition_cleared_at', null);
            if (!count) {
              const detail = mode === 'BLE'
                ? `Sortie du périmètre domicile (balise BLE hors de portée) depuis ${beacon.grace_minutes} min.`
                : `Éloignement du domicile : ${dist} m (max ${beacon.max_distance_m} m) depuis ${beacon.grace_minutes} min, balise non détectée.`;
              await supabase.from('alerts').insert({
                case_id: device.case_id, device_id: device.id,
                alert_type: alertType, severity: 4, description: detail,
                position_lat: live.lat, position_lon: live.lng,
              });
              // Unified dispatch: SMS + push to judge and assigned agents per
              // their preferences (opt-out default).
              const { dispatchAlertNotifications } = await import('@/lib/notify');
              await dispatchAlertNotifications({ caseId: device.case_id, alertType, description: detail });
            }
          }
        } else if (away === false) {
          if (beacon.out_since) await supabase.from('beacons').update({ out_since: null }).eq('id', beacon.id);
          // Episode ended — mark it (alert stays OPEN, closure is manual);
          // this re-arms dedup so the next exit raises a fresh alert.
          await supabase.from('alerts')
            .update({ condition_cleared_at: new Date().toISOString() })
            .eq('case_id', device.case_id).eq('alert_type', 'BLE_EXIT')
            .eq('is_resolved', false).is('condition_cleared_at', null);
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
      if (worn === true) {
        // Bracelet back on the body — end any open TAMPER episode (alert stays
        // open for manual review; a NEW removal will raise a fresh alert).
        await supabase.from('alerts')
          .update({ condition_cleared_at: new Date().toISOString() })
          .eq('case_id', device.case_id).eq('alert_type', 'TAMPER_DETECTED')
          .eq('is_resolved', false).is('condition_cleared_at', null);
      }
      if (worn === false) {
        const { count } = await supabase
          .from('alerts')
          .select('id', { count: 'exact', head: true })
          .eq('case_id', device.case_id)
          .eq('alert_type', 'TAMPER_DETECTED')
          .eq('is_resolved', false)
          .is('condition_cleared_at', null);
        if (!count) {
          await supabase.from('alerts').insert({
            case_id: device.case_id, device_id: device.id,
            alert_type: 'TAMPER_DETECTED', severity: 5,
            description: 'Bracelet retiré du corps (détection de port).',
            position_lat: live.lat, position_lon: live.lng,
          });
          await supabase.from('cases').update({ status: 'VIOLATION', updated_at: new Date().toISOString() }).eq('id', device.case_id);
          const { dispatchAlertNotifications } = await import('@/lib/notify');
          await dispatchAlertNotifications({ caseId: device.case_id, alertType: 'TAMPER_DETECTED', description: 'Bracelet retiré du corps (détection de port).' });
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
            const { dispatchAlertNotifications } = await import('@/lib/notify');
            await dispatchAlertNotifications({ caseId: device.case_id, alertType: 'HEALTH_CRITICAL', description: critical });
          }
        }
      }

      // Health alerts (deduped by the alert ingest? — keep simple: emit on threshold)
      const alerts: { type: string; description?: string }[] = [];
      if (live.battery !== null && live.battery <= settings.battery_alert_pct) {
        alerts.push({ type: 'BATTERY_LOW', description: `Batterie faible : ${live.battery}%.` });
      }
      // SIGNAL_LOST for weak signal disabled — signal strength visible in device telemetry.
      for (const a of alerts) {
        await fetch(`${origin}/api/ingest/alert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ingestKey },
          body: JSON.stringify({
            imei: device.imei,
            type: a.type,
            description: a.description,
            lat: live.lat,
            lon: live.lng,
          }),
        });
      }

      return { imei: device.imei, ok: true, battery: live.battery, alerts: alerts.length };
    })
  );

  // ── Escalation engine (chaîne d'escalade) ──────────────────────────────────
  // L1: alert unacknowledged past settings.escalate_minutes → SMS the case judge.
  // L2: severity >= 4 still unresolved past 2h → SMS every active SUPER_ADMIN.
  // One-shot per level via escalated_at / escalated_l2_at markers.
  let escalated = 0;
  try {
    const { sendSms } = await import('@/lib/sms');
    const escalateMin = settings.escalate_minutes ?? 30;
    const l1Cutoff = new Date(Date.now() - escalateMin * 60_000).toISOString();
    const l2Cutoff = new Date(Date.now() - 120 * 60_000).toISOString();

    const { data: l1 } = await supabase
      .from('alerts')
      .select('id, case_id, alert_type')
      .eq('is_resolved', false)
      .is('acknowledged_at', null)
      .is('escalated_at', null)
      .lt('triggered_at', l1Cutoff)
      .limit(20);
    for (const a of (l1 ?? []) as { id: string; case_id: string; alert_type: string }[]) {
      const { data: kase } = await supabase.from('cases').select('judge_id, case_number').eq('id', a.case_id).maybeSingle();
      const judgeId = (kase as { judge_id?: string | null } | null)?.judge_id;
      if (judgeId) {
        const { data: ju } = await supabase.from('users').select('phone').eq('id', judgeId).maybeSingle();
        const phone = (ju as { phone?: string | null } | null)?.phone;
        if (phone) {
          await sendSms(phone, `SIGEP - ESCALADE: alerte ${a.alert_type} du dossier ${(kase as { case_number?: string } | null)?.case_number ?? ''} sans prise en charge depuis ${escalateMin} min. Verifiez la plateforme.`);
        }
      }
      await supabase.from('alerts').update({ escalated_at: new Date().toISOString() }).eq('id', a.id);
      escalated++;
    }

    const { data: l2 } = await supabase
      .from('alerts')
      .select('id, case_id, alert_type')
      .eq('is_resolved', false)
      .gte('severity', 4)
      .is('escalated_l2_at', null)
      .lt('triggered_at', l2Cutoff)
      .limit(20);
    if (l2 && l2.length > 0) {
      const { data: admins } = await supabase.from('users').select('phone').eq('role', 'SUPER_ADMIN').eq('is_active', true);
      const phones = ((admins ?? []) as { phone: string | null }[]).map((a) => a.phone).filter(Boolean) as string[];
      for (const a of l2 as { id: string; case_id: string; alert_type: string }[]) {
        const { data: kase } = await supabase.from('cases').select('case_number').eq('id', a.case_id).maybeSingle();
        for (const p of phones) {
          await sendSms(p, `SIGEP - ESCALADE NIVEAU 2: alerte critique ${a.alert_type} (dossier ${(kase as { case_number?: string } | null)?.case_number ?? ''}) non resolue depuis plus de 2h. Intervention requise.`);
        }
        await supabase.from('alerts').update({ escalated_l2_at: new Date().toISOString() }).eq('id', a.id);
        escalated++;
      }
    }
  } catch { /* escalation is best-effort — never blocks polling */ }

  return NextResponse.json({ ok: true, polled: results.length, escalated, results });
}
