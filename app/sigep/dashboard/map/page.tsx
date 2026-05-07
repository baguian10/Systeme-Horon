import { Wifi, WifiOff, AlertTriangle, MapPin } from 'lucide-react';
import { fetchCases, fetchLatestPositions } from '@/lib/mock/helpers';
import { getSession } from '@/lib/auth/session';
import LeafletMapWrapper from '@/components/map/LeafletMapWrapper';
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

export default async function MapPage() {
  const session = await getSession();
  if (!session) return null;

  const [cases, positions] = await Promise.all([
    fetchCases(session.role, session.id),
    fetchLatestPositions(),
  ]);

  const activeCases = cases.filter((c) => c.status === 'ACTIVE' || c.status === 'VIOLATION');
  const onlineCount  = activeCases.filter((c) => c.device?.is_online).length;
  const alertCount   = activeCases.filter((c) => c.status === 'VIOLATION').length;

  const markers: TrackerMarker[] = positions.map((pos) => {
    const relatedCase = cases.find((c) => c.id === pos.case_id);
    return {
      id:              pos.id,
      caseRef:         pos.case_number,
      label:           relatedCase?.individual?.full_name ?? pos.case_number,
      lat:             pos.latitude,
      lng:             pos.longitude,
      status:          STATUS_TO_TRACKER[relatedCase?.status ?? 'PENDING'] ?? 'offline',
      lastUpdate:      new Date(pos.recorded_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      geofenceRadius:  relatedCase?.geofences?.[0] ? 500 : undefined,
    };
  });

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Carte de surveillance</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Ouagadougou, Burkina Faso — positions en temps réel
          </p>
        </div>
        <div className="flex items-center gap-3">
          {alertCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs font-semibold text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              {alertCount} violation{alertCount > 1 ? 's' : ''}
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs font-medium text-green-700">
            <Wifi className="w-3.5 h-3.5" />
            {onlineCount} en ligne
          </div>
        </div>
      </div>

      {/* Leaflet map — explicit h-[600px] so MapContainer height:100% resolves correctly */}
      <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
        <LeafletMapWrapper markers={markers} />
      </div>

      {/* Device cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeCases.map((c) => {
          const pos = positions.find((p) => p.case_id === c.id);
          const trackerStatus = STATUS_TO_TRACKER[c.status] ?? 'offline';
          const statusColor = trackerStatus === 'alert' ? 'text-red-600 bg-red-50 border-red-100'
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

              {/* Status badge */}
              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColor} mb-3`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {trackerStatus === 'alert' ? 'Violation de périmètre'
                  : trackerStatus === 'active' ? 'Surveillance active'
                  : 'Hors ligne'}
              </div>

              {c.device && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full transition-all ${(c.device.battery_pct ?? 0) < 20 ? 'bg-red-400' : 'bg-green-400'}`}
                        style={{ width: `${c.device.battery_pct ?? 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-8 text-right">{c.device.battery_pct}%</span>
                  </div>
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
    </div>
  );
}
