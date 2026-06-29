import { Wifi, AlertTriangle, Flame } from 'lucide-react';
import { fetchCases, fetchLatestPositions, fetchViolationHeatPoints, fetchGeofences } from '@/lib/mock/helpers';
import { getSession } from '@/lib/auth/session';
import HeatmapWrapper from '@/components/map/HeatmapWrapper';
import MapViewToggle from '@/components/map/MapViewToggle';
import SurveillanceView from '@/components/surveillance/SurveillanceView';
import type { TrackerMarker, MapGeofence } from '@/components/map/TrackingMap';

export const metadata = { title: 'Carte de surveillance — SIGEP' };
export const dynamic = 'force-dynamic';

const STATUS_TO_TRACKER: Record<string, TrackerMarker['status']> = {
  ACTIVE:     'active',
  VIOLATION:  'alert',
  PENDING:    'offline',
  SUSPENDED:  'offline',
  TERMINATED: 'offline',
};

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const { view } = await searchParams;
  const showHeatmap = view === 'heatmap';

  const [cases, positions, heatPoints, geofences] = await Promise.all([
    fetchCases(session.role, session.id),
    fetchLatestPositions(),
    fetchViolationHeatPoints(),
    fetchGeofences(),
  ]);

  // Real geofences for the surveillance map (blue = inclusion, red = exclusion).
  const mapGeofences: MapGeofence[] = geofences
    .filter((g) => g.status !== 'REQUESTED')
    .map((g) => ({
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
    }));

  const activeCases  = cases.filter((c) => c.status === 'ACTIVE' || c.status === 'VIOLATION');
  const onlineCount  = activeCases.filter((c) => c.device?.is_online).length;
  const alertCount   = activeCases.filter((c) => c.status === 'VIOLATION').length;

  const markers: TrackerMarker[] = positions.map((pos) => {
    const relatedCase = cases.find((c) => c.id === pos.case_id);
    return {
      id:             pos.id,
      caseId:         pos.case_id,
      caseRef:        pos.case_number,
      label:          relatedCase?.individual?.full_name ?? pos.case_number,
      lat:            pos.latitude,
      lng:            pos.longitude,
      status:         STATUS_TO_TRACKER[relatedCase?.status ?? 'PENDING'] ?? 'offline',
      lastUpdate:     new Date(pos.recorded_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      lastSeenMs:     Date.parse(pos.recorded_at),
      battery:        relatedCase?.device?.battery_pct ?? null,
      speedKmh:       pos.speed_kmh ?? null,
      online:         relatedCase?.device?.is_online ?? false,
    };
  });

  // Heatmap stats
  const hotZones = heatPoints.filter((p) => p.intensity >= 4).length;

  // Real hot-zone aggregation (only when viewing the heatmap): bucket points to
  // ~1.1 km cells, sum intensity, reverse-geocode the top centroids for a label.
  let zones: { name: string; count: number; intensity: number }[] = [];
  let maxZoneIntensity = 1;
  if (showHeatmap && heatPoints.length > 0) {
    const buckets = new Map<string, { lat: number; lng: number; n: number; intensity: number }>();
    for (const p of heatPoints) {
      const key = `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`;
      const b = buckets.get(key) ?? { lat: 0, lng: 0, n: 0, intensity: 0 };
      b.lat += p.lat; b.lng += p.lng; b.n += 1; b.intensity += p.intensity;
      buckets.set(key, b);
    }
    const top = [...buckets.values()]
      .map((b) => ({ lat: b.lat / b.n, lng: b.lng / b.n, count: b.n, intensity: b.intensity }))
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 5);
    const { reverseGeocode } = await import('@/lib/geo/reverse');
    zones = await Promise.all(top.map(async (z, i) => ({
      name: (i < 3 ? await reverseGeocode(z.lat, z.lng) : null) ?? `${z.lat.toFixed(3)}, ${z.lng.toFixed(3)}`,
      count: z.count,
      intensity: z.intensity,
    })));
    maxZoneIntensity = Math.max(1, ...zones.map((z) => z.intensity));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Carte de surveillance</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Ouagadougou, Burkina Faso — {showHeatmap ? 'chaleur des violations' : 'positions en temps réel'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {alertCount > 0 && !showHeatmap && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs font-semibold text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              {alertCount} violation{alertCount > 1 ? 's' : ''}
            </div>
          )}
          {!showHeatmap && (
            <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs font-medium text-green-700">
              <Wifi className="w-3.5 h-3.5" />
              {onlineCount} en ligne
            </div>
          )}
          {showHeatmap && (
            <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs font-medium text-orange-700">
              <Flame className="w-3.5 h-3.5" />
              {hotZones} zones à risque élevé
            </div>
          )}
          {/* View toggle */}
          <MapViewToggle currentView={showHeatmap ? 'heatmap' : 'tracking'} />
        </div>
      </div>

      {/* Map */}
      {showHeatmap ? (
        <div className="h-[580px] w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
          <HeatmapWrapper points={heatPoints} />
        </div>
      ) : (
        <SurveillanceView initialMarkers={markers} geofences={mapGeofences} />
      )}

      {/* Heatmap legend + stats when in heatmap mode */}
      {showHeatmap && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Legend */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Échelle d&apos;intensité</h3>
            <div className="space-y-2">
              {[
                { label: 'Très élevé (5)', color: 'bg-red-500',    text: 'text-red-700',    desc: 'Zone critique — révision géofence recommandée' },
                { label: 'Élevé (4)',       color: 'bg-orange-500', text: 'text-orange-700', desc: 'Surveillance renforcée nécessaire' },
                { label: 'Moyen (3)',       color: 'bg-yellow-500', text: 'text-yellow-700', desc: 'À surveiller — pattern récurrent' },
                { label: 'Faible (2)',      color: 'bg-lime-500',   text: 'text-lime-700',   desc: 'Incidents isolés' },
                { label: 'Minimal (1)',     color: 'bg-green-500',  text: 'text-green-700',  desc: 'Occurrences rares' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <span className={`w-3 h-3 rounded-full ${item.color} flex-shrink-0 mt-0.5`} />
                  <div>
                    <p className={`text-xs font-semibold ${item.text}`}>{item.label}</p>
                    <p className="text-[10px] text-gray-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Zone stats — aggregated from real violation points */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Zones les plus chaudes</h3>
            {zones.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune violation enregistrée — rien à agréger.</p>
            ) : (
              <div className="space-y-3">
                {zones.map((z) => (
                  <div key={z.name}>
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-medium text-gray-700 truncate pr-2">{z.name}</p>
                      <span className="text-xs font-bold text-gray-900 whitespace-nowrap">{z.count} pt{z.count > 1 ? 's' : ''}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400 rounded-full" style={{ width: `${(z.intensity / maxZoneIntensity) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
