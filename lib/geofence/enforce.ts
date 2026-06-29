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
  if (!geofences || geofences.length === 0) return raised;

  for (const g of geofences as EnforceGeofence[]) {
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
      const desc = g.is_exclusion
        ? `Entrée dans la zone interdite "${g.name}".`
        : `Sortie de la zone "${g.name}".`;
      if (await insertDeduped(supabase, caseId, deviceId, 'GEOFENCE_EXIT', lat, lon, desc)) {
        raised.push({ alert_type: 'GEOFENCE_EXIT', geofenceName: g.name });
      }
    }
  }

  return raised;
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
