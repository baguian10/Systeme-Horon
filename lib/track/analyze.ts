// Movement-history analysis — pure functions, no I/O.
// Turns a raw chronological GPS trail into segments, gaps, stops, geofence
// crossings, curfew compliance and aggregate stats for the daily itinerary view
// and the judicial PDF report.

import type { Geofence } from '@/lib/supabase/types';

export interface RawPoint {
  lat: number;
  lng: number;
  t: number; // epoch ms
  speed: number | null; // km/h
  accuracy: number | null; // m
}

export interface Segment {
  points: RawPoint[];
}

export interface Gap {
  from: number; // epoch ms
  to: number;
  mins: number;
}

export interface Stop {
  lat: number;
  lng: number;
  start: number; // epoch ms
  end: number;
  durationMin: number;
  pointCount: number;
  address?: string | null;
}

export interface GeoEvent {
  t: number; // epoch ms
  type: 'ENTER' | 'EXIT';
  zoneId: string;
  zoneName: string;
  isExclusion: boolean;
}

export interface Stats {
  distanceKm: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number; // over moving points only
  activeMin: number; // time spent moving
  firstSeen: number | null; // epoch ms
  lastSeen: number | null;
  pointCount: number;
}

export interface CurfewWindow {
  zoneId: string;
  zoneName: string;
  start: string; // "HH:MM"
  end: string;
}

export interface CurfewViolation {
  from: number; // epoch ms
  to: number;
  mins: number;
}

export interface CurfewReport {
  windows: CurfewWindow[];
  compliant: boolean;
  violations: CurfewViolation[];
  outsideMin: number;
}

const EARTH_M = 6371000;

/** Great-circle distance in meters. */
export function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const la1 = toRad(aLat);
  const la2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Split a chronological trail into continuous segments; long time holes = gaps. */
export function buildSegments(
  points: RawPoint[],
  gapMinutes = 15,
): { segments: Segment[]; gaps: Gap[] } {
  const segments: Segment[] = [];
  const gaps: Gap[] = [];
  if (points.length === 0) return { segments, gaps };

  let current: RawPoint[] = [points[0]];
  const gapMs = gapMinutes * 60_000;

  for (let i = 1; i < points.length; i++) {
    const dt = points[i].t - points[i - 1].t;
    if (dt > gapMs) {
      segments.push({ points: current });
      gaps.push({
        from: points[i - 1].t,
        to: points[i].t,
        mins: Math.round(dt / 60_000),
      });
      current = [points[i]];
    } else {
      current.push(points[i]);
    }
  }
  segments.push({ points: current });
  return { segments, gaps };
}

/**
 * Detect dwell stops: runs of consecutive points staying within `radiusM` of an
 * anchor for at least `minMinutes`. Greedy — extends an anchor while points stay
 * close, then emits a stop and restarts.
 */
export function detectStops(
  points: RawPoint[],
  { radiusM = 30, minMinutes = 5 }: { radiusM?: number; minMinutes?: number } = {},
): Stop[] {
  const stops: Stop[] = [];
  if (points.length < 2) return stops;

  let i = 0;
  while (i < points.length) {
    const anchor = points[i];
    let j = i + 1;
    // sum for centroid
    let sumLat = anchor.lat;
    let sumLng = anchor.lng;
    let n = 1;
    while (
      j < points.length &&
      haversine(anchor.lat, anchor.lng, points[j].lat, points[j].lng) <= radiusM
    ) {
      sumLat += points[j].lat;
      sumLng += points[j].lng;
      n++;
      j++;
    }
    const durationMin = (points[j - 1].t - anchor.t) / 60_000;
    if (durationMin >= minMinutes && n >= 2) {
      stops.push({
        lat: sumLat / n,
        lng: sumLng / n,
        start: anchor.t,
        end: points[j - 1].t,
        durationMin: Math.round(durationMin),
        pointCount: n,
      });
      i = j;
    } else {
      i++;
    }
  }
  return stops;
}

/** Aggregate stats over the whole trail. */
export function computeStats(points: RawPoint[]): Stats {
  if (points.length === 0) {
    return {
      distanceKm: 0,
      maxSpeedKmh: 0,
      avgSpeedKmh: 0,
      activeMin: 0,
      firstSeen: null,
      lastSeen: null,
      pointCount: 0,
    };
  }
  let distanceM = 0;
  let maxSpeed = 0;
  let movingSpeedSum = 0;
  let movingCount = 0;
  let movingMs = 0;

  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    distanceM += d;
    const dt = points[i].t - points[i - 1].t;
    // moving if it covered meaningful ground
    if (d > 15) {
      movingMs += dt;
      const sp = points[i].speed ?? (dt > 0 ? (d / 1000) / (dt / 3_600_000) : 0);
      movingSpeedSum += sp;
      movingCount++;
    }
    const s = points[i].speed ?? 0;
    if (s > maxSpeed) maxSpeed = s;
  }

  return {
    distanceKm: Math.round((distanceM / 1000) * 100) / 100,
    maxSpeedKmh: Math.round(maxSpeed * 10) / 10,
    avgSpeedKmh: movingCount ? Math.round((movingSpeedSum / movingCount) * 10) / 10 : 0,
    activeMin: Math.round(movingMs / 60_000),
    firstSeen: points[0].t,
    lastSeen: points[points.length - 1].t,
    pointCount: points.length,
  };
}

// ---- geometry ----

function pointInCircle(lat: number, lng: number, g: Geofence): boolean {
  if (g.center_lat == null || g.center_lon == null || g.radius_m == null) return false;
  return haversine(lat, lng, g.center_lat, g.center_lon) <= g.radius_m;
}

function pointInPolygon(lat: number, lng: number, g: Geofence): boolean {
  const ring = g.area?.coordinates?.[0];
  if (!ring || ring.length < 3) return false;
  // ring is [lng, lat] pairs (GeoJSON). Ray casting on (x=lng, y=lat).
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isInside(lat: number, lng: number, g: Geofence): boolean {
  return g.shape_type === 'CIRCLE' ? pointInCircle(lat, lng, g) : pointInPolygon(lat, lng, g);
}

/** Detect ENTER/EXIT transitions for each geofence along the trail. */
export function geofenceEvents(points: RawPoint[], geofences: Geofence[]): GeoEvent[] {
  const events: GeoEvent[] = [];
  for (const g of geofences) {
    let prev: boolean | null = null;
    for (const p of points) {
      const now = isInside(p.lat, p.lng, g);
      if (prev !== null && now !== prev) {
        events.push({
          t: p.t,
          type: now ? 'ENTER' : 'EXIT',
          zoneId: g.id,
          zoneName: g.name,
          isExclusion: g.is_exclusion,
        });
      }
      prev = now;
    }
  }
  return events.sort((a, b) => a.t - b.t);
}

// ---- curfew ----

function parseHM(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Curfew compliance for a single day. A curfew zone = inclusion geofence
 * (is_exclusion === false) with an active window. During the window the subject
 * must be inside at least one curfew zone; spans spent outside all of them are
 * violations. Supports overnight windows (end < start).
 *
 * `dayStartMs` = local midnight of the analysed day (epoch ms).
 */
export function curfewCompliance(
  points: RawPoint[],
  geofences: Geofence[],
  dayStartMs: number,
): CurfewReport {
  const curfewZones = geofences.filter(
    (g) => !g.is_exclusion && g.active_start && g.active_end,
  );
  if (curfewZones.length === 0) {
    return { windows: [], compliant: true, violations: [], outsideMin: 0 };
  }

  const windows: CurfewWindow[] = curfewZones.map((g) => ({
    zoneId: g.id,
    zoneName: g.name,
    start: (g.active_start ?? '').slice(0, 5),
    end: (g.active_end ?? '').slice(0, 5),
  }));

  // Build the set of [from,to] minute intervals (epoch ms) that are "under curfew".
  const intervals: Array<[number, number]> = [];
  for (const g of curfewZones) {
    const s = parseHM(g.active_start!);
    const e = parseHM(g.active_end!);
    if (s == null || e == null) continue;
    if (e > s) {
      intervals.push([dayStartMs + s * 60_000, dayStartMs + e * 60_000]);
    } else {
      // overnight: [start, midnight] + [midnight, end]
      intervals.push([dayStartMs + s * 60_000, dayStartMs + 24 * 3_600_000]);
      intervals.push([dayStartMs, dayStartMs + e * 60_000]);
    }
  }

  const underCurfew = (t: number) => intervals.some(([a, b]) => t >= a && t <= b);
  const insideAnyZone = (p: RawPoint) => curfewZones.some((g) => isInside(p.lat, p.lng, g));

  const violations: CurfewViolation[] = [];
  let vStart: number | null = null;
  let prevT: number | null = null;

  for (const p of points) {
    const inWindow = underCurfew(p.t);
    const compliantNow = !inWindow || insideAnyZone(p);
    if (!compliantNow) {
      if (vStart === null) vStart = prevT ?? p.t;
    } else if (vStart !== null) {
      violations.push({ from: vStart, to: prevT ?? p.t, mins: Math.round(((prevT ?? p.t) - vStart) / 60_000) });
      vStart = null;
    }
    prevT = p.t;
  }
  if (vStart !== null && prevT !== null) {
    violations.push({ from: vStart, to: prevT, mins: Math.round((prevT - vStart) / 60_000) });
  }

  const outsideMin = violations.reduce((s, v) => s + v.mins, 0);
  return { windows, compliant: violations.length === 0, violations, outsideMin };
}
