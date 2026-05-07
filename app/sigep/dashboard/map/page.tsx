import { Wifi, WifiOff, AlertTriangle, MapPin, Flame } from 'lucide-react';
import { fetchCases, fetchLatestPositions, fetchViolationHeatPoints } from '@/lib/mock/helpers';
import { getSession } from '@/lib/auth/session';
import LeafletMapWrapper from '@/components/map/LeafletMapWrapper';
import HeatmapWrapper from '@/components/map/HeatmapWrapper';
import MapViewToggle from '@/components/map/MapViewToggle';
import type { TrackerMarker } from '@/components/map/TrackingMap';

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

  const [cases, positions, heatPoints] = await Promise.all([
    fetchCases(session.role, session.id),
    fetchLatestPositions(),
    fetchViolationHeatPoints(),
  ]);

  const activeCases  = cases.filter((c) => c.status === 'ACTIVE' || c.status === 'VIOLATION');
  const onlineCount  = activeCases.filter((c) => c.device?.is_online).length;
  const alertCount   = activeCases.filter((c) => c.status === 'VIOLATION').length;

  const markers: TrackerMarker[] = positions.map((pos) => {
    const relatedCase = cases.find((c) => c.id === pos.case_id);
    return {
      id:             pos.id,
      caseRef:        pos.case_number,
      label:          relatedCase?.individual?.full_name ?? pos.case_number,
      lat:            pos.latitude,
      lng:            pos.longitude,
      status:         STATUS_TO_TRACKER[relatedCase?.status ?? 'PENDING'] ?? 'offline',
      lastUpdate:     new Date(pos.recorded_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      geofenceRadius: relatedCase?.geofences?.[0] ? 500 : undefined,
    };
  });

  // Heatmap stats
  const hotZones = heatPoints.filter((p) => p.intensity >= 4).length;
  const totalViolations = heatPoints.reduce((acc, p) => acc + p.intensity, 0);

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
      <div className="h-[580px] w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
        {showHeatmap ? (
          <HeatmapWrapper points={heatPoints} />
        ) : (
          <LeafletMapWrapper markers={markers} />
        )}
      </div>

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

          {/* Zone stats */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Analyse par zone</h3>
            <div className="space-y-3">
              {[
                { zone: 'Axe Route de Bobo',   count: 14, tip: 'Déplacements nocturnes non autorisés' },
                { zone: 'Centre / Baskuy',      count: 14, tip: 'Marché central — forte densité' },
                { zone: 'Bogodogo / Sect. 22',  count: 18, tip: 'Zone domiciliaire à risque élevé' },
                { zone: 'Sig-Nonghin / Pissy',  count: 9,  tip: 'Périphérie ouest' },
                { zone: 'Nongremassom',         count: 6,  tip: 'Secteur nord' },
              ].sort((a, b) => b.count - a.count).map((z) => (
                <div key={z.zone}>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-xs font-medium text-gray-700">{z.zone}</p>
                    <span className="text-xs font-bold text-gray-900">{z.count} pts</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-0.5">
                    <div
                      className="h-full bg-orange-400 rounded-full"
                      style={{ width: `${(z.count / 18) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400">{z.tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Device cards — tracking mode only */}
      {!showHeatmap && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeCases.map((c) => {
            const pos = positions.find((p) => p.case_id === c.id);
            const trackerStatus = STATUS_TO_TRACKER[c.status] ?? 'offline';
            const statusColor = trackerStatus === 'alert'  ? 'text-red-600 bg-red-50 border-red-100'
                              : trackerStatus === 'active' ? 'text-green-700 bg-green-50 border-green-100'
                              : 'text-gray-500 bg-gray-50 border-gray-100';
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-gray-800 truncate">{c.case_number}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{c.individual?.full_name ?? '—'}</p>
                  </div>
                  {c.device?.is_online
                    ? <Wifi className="w-4 h-4 text-green-500 flex-shrink-0" />
                    : <WifiOff className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                </div>
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColor} mb-3`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {trackerStatus === 'alert' ? 'Violation de périmètre' : trackerStatus === 'active' ? 'Surveillance active' : 'Hors ligne'}
                </div>
                {c.device && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${(c.device.battery_pct ?? 0) < 20 ? 'bg-red-400' : 'bg-green-400'}`}
                        style={{ width: `${c.device.battery_pct ?? 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">{c.device.battery_pct}%</span>
                  </div>
                )}
                {pos && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                    <MapPin className="w-3 h-3" />
                    {pos.latitude.toFixed(4)}, {pos.longitude.toFixed(4)}
                  </div>
                )}
              </div>
            );
          })}
          {activeCases.length === 0 && (
            <div className="col-span-3 text-center py-10 text-gray-400 text-sm">
              Aucun dossier actif en surveillance.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
