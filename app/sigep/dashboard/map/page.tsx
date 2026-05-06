import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { fetchCases, fetchLatestPositions } from '@/lib/mock/helpers';
import { getSession } from '@/lib/auth/session';
import MapGrid from '@/components/dashboard/MapGrid';
import type { CaseStatus } from '@/lib/supabase/types';

export const metadata = { title: 'Surveillance — SIGEP' };
export const revalidate = 30;

export default async function MapPage() {
  const session = await getSession();
  if (!session) return null;

  const [cases, positions] = await Promise.all([
    fetchCases(session.role, session.id),
    fetchLatestPositions(),
  ]);

  const activeCases = cases.filter((c) => c.status === 'ACTIVE' || c.status === 'VIOLATION');
  const onlineDevices = activeCases.filter((c) => c.device?.is_online).length;

  const mapPoints = positions.map((pos) => {
    const relatedCase = cases.find((c) => c.id === pos.case_id);
    return {
      label: pos.case_number,
      lat: pos.latitude,
      lon: pos.longitude,
      status: (relatedCase?.status ?? 'ACTIVE') as CaseStatus,
      alertCount: relatedCase?.alert_count ?? 0,
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Surveillance en temps réel</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {onlineDevices} bracelet{onlineDevices !== 1 ? 's' : ''} en ligne · actualisation toutes les 30s
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white border border-gray-100 rounded-lg px-3 py-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Auto-refresh 30s
        </div>
      </div>

      {/* Map */}
      <div style={{ height: 440 }}>
        <MapGrid points={mapPoints} />
      </div>

      {/* Device status grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeCases.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="font-mono text-xs font-semibold text-gray-700">{c.case_number}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{c.individual?.full_name ?? '—'}</p>
              </div>
              {c.device?.is_online
                ? <Wifi className="w-4 h-4 text-green-500 flex-shrink-0" />
                : <WifiOff className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            </div>

            {c.device && (
              <div className="space-y-1.5">
                {/* Battery bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${(c.device.battery_pct ?? 0) < 20 ? 'bg-red-400' : 'bg-green-400'}`}
                      style={{ width: `${c.device.battery_pct ?? 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">{c.device.battery_pct}%</span>
                </div>
                <p className="text-[10px] font-mono text-gray-400 truncate">IMEI: {c.device.imei}</p>
              </div>
            )}

            {(c.alert_count ?? 0) > 0 && (
              <div className="mt-2 bg-red-50 rounded-lg px-2 py-1">
                <p className="text-xs text-red-600 font-medium">
                  {c.alert_count} alerte{(c.alert_count ?? 0) > 1 ? 's' : ''} active{(c.alert_count ?? 0) > 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
