// Shared daily-itinerary analysis used by both the history API and the PDF report.
import type { Geofence } from '@/lib/supabase/types';
import {
  buildSegments,
  detectStops,
  computeStats,
  geofenceEvents,
  curfewCompliance,
  type RawPoint,
  type Stop,
  type Gap,
  type GeoEvent,
  type Stats,
  type CurfewReport,
} from '@/lib/track/analyze';
import { reverseGeocodeMany } from '@/lib/geo/reverse';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DayItinerary {
  date: string;
  points: RawPoint[];
  segments: [number, number][][];
  gaps: Gap[];
  stops: Stop[];
  events: GeoEvent[];
  stats: Stats;
  curfew: CurfewReport;
  geofences: MappedGeofence[];
}

export interface MappedGeofence {
  id: string;
  name: string;
  isExclusion: boolean;
  polygon: [number, number][] | null;
  center: [number, number] | null;
  radiusM: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

export function emptyDay(date: string): DayItinerary {
  return {
    date, points: [], segments: [], gaps: [], stops: [], events: [],
    stats: { distanceKm: 0, maxSpeedKmh: 0, avgSpeedKmh: 0, activeMin: 0, firstSeen: null, lastSeen: null, pointCount: 0 },
    curfew: { windows: [], compliant: true, violations: [], outsideMin: 0 },
    geofences: [],
  };
}

function geoToMap(g: Geofence): MappedGeofence {
  return {
    id: g.id,
    name: g.name,
    isExclusion: g.is_exclusion,
    polygon: g.shape_type === 'POLYGON' && g.area?.coordinates?.[0]
      ? g.area.coordinates[0].map((c) => [c[1], c[0]] as [number, number])
      : null,
    center: g.shape_type === 'CIRCLE' && g.center_lat != null && g.center_lon != null
      ? [g.center_lat, g.center_lon] as [number, number]
      : null,
    radiusM: g.radius_m ?? null,
  };
}

/** Fetch + analyze one civil day (UTC = Burkina local) for a case. */
export async function analyzeDay(
  supabase: SupabaseLike,
  caseId: string,
  date: string,
  opts: { geocode?: boolean } = {},
): Promise<DayItinerary> {
  const dayStartMs = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(dayStartMs)) return emptyDay(date);
  const from = new Date(dayStartMs).toISOString();
  const to = new Date(dayStartMs + DAY_MS).toISOString();

  const [{ data: posData }, { data: geoData }] = await Promise.all([
    supabase
      .from('positions')
      .select('latitude, longitude, speed_kmh, accuracy_m, recorded_at')
      .eq('case_id', caseId)
      .gte('recorded_at', from)
      .lt('recorded_at', to)
      .order('recorded_at', { ascending: true })
      .limit(20000),
    supabase.from('geofences').select('*').eq('case_id', caseId),
  ]);

  const points: RawPoint[] = (posData ?? []).map((p: Record<string, unknown>) => ({
    lat: p.latitude as number,
    lng: p.longitude as number,
    t: Date.parse(p.recorded_at as string),
    speed: (p.speed_kmh as number | null) ?? null,
    accuracy: (p.accuracy_m as number | null) ?? null,
  }));
  if (points.length === 0) return emptyDay(date);

  const geofences = (geoData ?? []) as Geofence[];
  const { segments, gaps } = buildSegments(points, 15);
  const stops = detectStops(points, { radiusM: 30, minMinutes: 5 });
  const stats = computeStats(points);
  const events = geofenceEvents(points, geofences);
  const curfew = curfewCompliance(points, geofences, dayStartMs);

  if (opts.geocode !== false && stops.length) {
    const labels = await reverseGeocodeMany(stops.map((s) => ({ lat: s.lat, lng: s.lng })));
    stops.forEach((s, i) => (s.address = labels[i] ?? null));
  }

  return {
    date,
    points,
    segments: segments.map((s) => s.points.map((p) => [p.lat, p.lng] as [number, number])),
    gaps,
    stops,
    events,
    stats,
    curfew,
    geofences: geofences.map(geoToMap),
  };
}
