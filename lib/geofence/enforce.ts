// Server-side geofence + curfew enforcement.
// Single chokepoint called from the position ingest pipeline.
//
// Rules:
//  - Exclusion zone            → violation when INSIDE (immediate).
//  - Inclusion zone, no hours  → violation when OUTSIDE (immediate). GEOFENCE_EXIT.
//  - Inclusion zone WITH hours → CURFEW: only enforced inside the active window;
//                                outside the zone during the window for longer
//                                than grace_minutes → CURFEW_VIOLATION.
// Times are compared in UTC (Burkina Faso = UTC+0). REQUESTED geofences (not yet
// validated by an admin) are skipped.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any;

export interface EnforceGeofence {
  id: string;
  name: string;
  is_exclusion: boolean;
  shape_type: 'POLYGON' | 'CIRCLE';
  area: { coordinates: number[][][] } | null;
  center_lat: number | null;
  center_lon: number | null;
  radius_m: number | null;
  active_start: string | null;
  active_end: string | null;
  grace_minutes: number | null;
  out_since: string | null;
  status?: string | null;
}

const EARTH_M = 6371000;

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLng = r(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pointInPolygon(lat: number, lon: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function insideGeofence(lat: number, lon: number, g: EnforceGeofence): boolean {
  if (g.shape_type === 'CIRCLE') {
    if (g.center_lat == null || g.center_lon == null || g.radius_m == null) return false;
    return haversine(lat, lon, g.center_lat, g.center_lon) <= g.radius_m;
  }
  const ring = g.area?.coordinates?.[0];
  if (!ring || ring.length < 3) return false;
  return pointInPolygon(lat, lon, ring);
}

function parseHM(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Is `nowMs` within [start,end] (UTC minutes), handling overnight windows. */
export function withinWindow(start: string, end: string, nowMs: number): boolean {
  const s = parseHM(start);
  const e = parseHM(end);
  if (s == null || e == null) return true;
  const d = new Date(nowMs);
  const cur = d.getUTCHours() * 60 + d.getUTCMinutes();
  return e >= s ? cur >= s && cur <= e : cur >= s || cur <= e; // overnight
}

/**
 * Is the case-level structured curfew active now? Days are 0=Sun…6=Sat (UTC,
 * Burkina Faso = UTC+0). For an overnight window (start > end), the early-morning
 * part belongs to the day the curfew STARTED, so we also match the previous day.
 * Empty days list means the curfew applies every day.
 */
export function withinCurfewSchedule(
  days: number[] | null | undefined,
  start: string | null,
  end: string | null,
  nowMs: number,
): boolean {
  if (!start || !end) return false;
  const s = parseHM(start);
  const e = parseHM(end);
  if (s == null || e == null) return false;
  const d = new Date(nowMs);
  const cur = d.getUTCHours() * 60 + d.getUTCMinutes();
  const day = d.getUTCDay();
  const prevDay = (day + 6) % 7;
  const everyDay = !days || days.length === 0;
  const onDay = (x: number) => everyDay || days!.includes(x);
  if (e >= s) {
    // same-day window
    return onDay(day) && cur >= s && cur <= e;
  }
  // overnight window: [start..24h) on the start day, and [0..end] on the next day
  return (onDay(day) && cur >= s) || (onDay(prevDay) && cur <= e);
}

interface RaisedAlert {
  alert_type: 'GEOFENCE_EXIT' | 'CURFEW_VIOLATION';
  geofenceName: string;
}

/**
 * Run all enforcement for one fresh position. Inserts deduped alerts and
 * maintains per-geofence `out_since` grace state. Returns the alerts raised.
 */
export async function enforceGeofences(
  supabase: Supabase,
  args: { caseId: string; deviceId: string; lat: number; lon: number; nowMs?: number },
): Promise<RaisedAlert[]> {
  const { caseId, deviceId, lat, lon } = args;
  const nowMs = args.nowMs ?? Date.now();

  const { data: geofences } = await supabase
    .from('geofences')
    .select('id, name, is_exclusion, shape_type, area, center_lat, center_lon, radius_m, active_start, active_end, grace_minutes, out_since, status')
    .eq('case_id', caseId);

  const raised: RaisedAlert[] = [];
  const zones = (geofences ?? []) as EnforceGeofence[];

  // ── Cross-check home-exit against the BLE beacon ──
  // GPS drifts indoors, so "outside the home zone" is confirmed only when the
  // home beacon is ALSO out of range. If the beacon is still seen, the subject
  // is home → the GPS reading is drift and the exit is suppressed.
  //   'in'   → beacon in range (suppress inclusion-zone exit)
  //   'out'  → beacon out of range (GPS exit confirmed)
  //   'none' → no beacon / no scan data → GPS decides alone
  let homeBeacon: 'in' | 'out' | 'none' = 'none';
  const hasInclusionZone = zones.some((g) => !g.is_exclusion && !(g.active_start && g.active_end) && g.status !== 'REQUESTED');
  if (hasInclusionZone) {
    const { data: beacon } = await supabase
      .from('beacons')
      .select('uid, min_rssi')
      .eq('device_id', deviceId)
      .eq('alarm_enabled', true)
      .maybeSingle();
    const bUid = (beacon as { uid?: string | null; min_rssi?: number | null } | null)?.uid;
    if (bUid) {
      const { data: dev } = await supabase.from('devices').select('imei').eq('id', deviceId).maybeSingle();
      const imei = (dev as { imei?: string } | null)?.imei;
      if (imei) {
        const { getLatestBleScan } = await import('@/lib/traxbean/client');
        const scan = await getLatestBleScan(imei);
        if (scan) {
          const hit = scan.sightings.find((s) => s.mac === bUid.toUpperCase());
          const minRssi = (beacon as { min_rssi?: number | null }).min_rssi ?? -85;
          homeBeacon = hit && hit.rssi >= minRssi ? 'in' : 'out';
        }
      }
    }
  }

  // ── Case-level structured curfew (measure conditions) ──
  // During the curfew schedule (days + hours), the subject must be inside a home
  // inclusion zone. Outside every inclusion zone past the grace delay → violation.
  await enforceCaseCurfew(supabase, caseId, deviceId, lat, lon, nowMs, zones, raised);

  if (zones.length === 0) return raised;

  for (const g of zones) {
    if (g.status === 'REQUESTED') continue; // not yet validated by an admin
    const inside = insideGeofence(lat, lon, g);
    const hasWindow = !!(g.active_start && g.active_end);

    // ── CURFEW: time-windowed inclusion zone ──
    if (!g.is_exclusion && hasWindow) {
      const active = withinWindow(g.active_start!, g.active_end!, nowMs);
      if (active && !inside) {
        const since = g.out_since ? Date.parse(g.out_since) : null;
        if (since == null) {
          await supabase.from('geofences').update({ out_since: new Date(nowMs).toISOString() }).eq('id', g.id);
          continue; // start grace clock, no alert yet
        }
        const elapsedMin = (nowMs - since) / 60_000;
        if (elapsedMin >= (g.grace_minutes ?? 10)) {
          if (await insertDeduped(supabase, caseId, deviceId, 'CURFEW_VIOLATION', lat, lon,
            `Couvre-feu non respecté : hors de la zone "${g.name}" depuis ${Math.round(elapsedMin)} min.`)) {
            raised.push({ alert_type: 'CURFEW_VIOLATION', geofenceName: g.name });
          }
        }
      } else if (g.out_since) {
        // back inside, or window ended → reset grace clock
        await supabase.from('geofences').update({ out_since: null }).eq('id', g.id);
      }
      continue;
    }

    // ── Standard zones (immediate) ──
    const exclusionActive = !hasWindow || withinWindow(g.active_start!, g.active_end!, nowMs);
    const violated = g.is_exclusion ? inside && exclusionActive : !inside;
    if (violated) {
      // Inclusion (home) zone: if the home beacon is still in range, this is GPS
      // drift, not a real exit → suppress. Alarm only when both GPS and beacon
      // agree (beacon out / no beacon). Exclusion zones don't use the beacon.
      if (!g.is_exclusion && homeBeacon === 'in') continue;
      const desc = g.is_exclusion
        ? `Entrée dans la zone interdite "${g.name}".`
        : `Sortie de la zone "${g.name}"${homeBeacon === 'out' ? ' (confirmée par la balise BLE)' : ''}.`;
      if (await insertDeduped(supabase, caseId, deviceId, 'GEOFENCE_EXIT', lat, lon, desc)) {
        raised.push({ alert_type: 'GEOFENCE_EXIT', geofenceName: g.name });
      }
    }
  }

  return raised;
}

// Grace default (minutes) before a case-level curfew breach becomes an alert.
const CURFEW_GRACE_MIN = 10;

/**
 * Enforce the structured case-level curfew. The "home" is any validated
 * inclusion zone on the case. Uses cases.curfew_out_since as the grace clock,
 * mirroring the per-geofence out_since logic.
 */
async function enforceCaseCurfew(
  supabase: Supabase,
  caseId: string,
  deviceId: string,
  lat: number,
  lon: number,
  nowMs: number,
  zones: EnforceGeofence[],
  raised: RaisedAlert[],
): Promise<void> {
  const { data: c } = await supabase
    .from('cases')
    .select('curfew_days, curfew_start, curfew_end, curfew_out_since')
    .eq('id', caseId)
    .maybeSingle();
  if (!c) return;
  const curfew = c as { curfew_days: number[] | null; curfew_start: string | null; curfew_end: string | null; curfew_out_since: string | null };

  const active = withinCurfewSchedule(curfew.curfew_days, curfew.curfew_start, curfew.curfew_end, nowMs);
  if (!active) {
    if (curfew.curfew_out_since) await supabase.from('cases').update({ curfew_out_since: null }).eq('id', caseId);
    return;
  }

  // Home = any validated inclusion zone. No home zone configured → cannot assess.
  const homeZones = zones.filter((g) => !g.is_exclusion && g.status !== 'REQUESTED');
  if (homeZones.length === 0) return;
  const atHome = homeZones.some((g) => insideGeofence(lat, lon, g));

  if (atHome) {
    if (curfew.curfew_out_since) await supabase.from('cases').update({ curfew_out_since: null }).eq('id', caseId);
    return;
  }

  // Outside home during curfew — run the grace clock.
  const since = curfew.curfew_out_since ? Date.parse(curfew.curfew_out_since) : null;
  if (since == null) {
    await supabase.from('cases').update({ curfew_out_since: new Date(nowMs).toISOString() }).eq('id', caseId);
    return; // start grace, no alert yet
  }
  const elapsedMin = (nowMs - since) / 60_000;
  if (elapsedMin >= CURFEW_GRACE_MIN) {
    if (await insertDeduped(supabase, caseId, deviceId, 'CURFEW_VIOLATION', lat, lon,
      `Couvre-feu non respecté : hors du domicile depuis ${Math.round(elapsedMin)} min.`)) {
      raised.push({ alert_type: 'CURFEW_VIOLATION', geofenceName: 'domicile' });
    }
  }
}

/** Insert an alert unless an unresolved one of the same type already exists. */
async function insertDeduped(
  supabase: Supabase,
  caseId: string,
  deviceId: string,
  type: 'GEOFENCE_EXIT' | 'CURFEW_VIOLATION',
  lat: number,
  lon: number,
  description: string,
): Promise<boolean> {
  const { count } = await supabase
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .eq('alert_type', type)
    .eq('is_resolved', false);
  if (count && count > 0) return false;

  await supabase.from('alerts').insert({
    case_id: caseId,
    device_id: deviceId,
    alert_type: type,
    severity: 4,
    description,
    position_lat: lat,
    position_lon: lon,
  });
  return true;
}
