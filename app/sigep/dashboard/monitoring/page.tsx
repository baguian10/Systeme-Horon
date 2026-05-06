import LiveMapGrid from '@/components/realtime/LiveMapGrid';
import DemoControls from '@/components/realtime/DemoControls';
import { fetchCases, fetchAlerts } from '@/lib/mock/helpers';
import { getSession } from '@/lib/auth/session';
import type { LivePosition } from '@/hooks/usePositionFeed';
import type { CaseStatus } from '@/lib/supabase/types';
import { AlertTypeBadge, SeverityDot } from '@/components/ui/StatusBadge';
import Link from 'next/link';
import { Wifi, WifiOff, Battery, RefreshCw } from 'lucide-react';

export const metadata = { title: 'Monitoring temps réel — SIGEP' };
export const revalidate = 0;

export default async function MonitoringPage() {
  const session = await getSession();
  if (!session) return null;

  const [cases, alerts] = await Promise.all([
    fetchCases(session.role, session.id),
    fetchAlerts(session.role),
  ]);

  const activeCases = cases.filter((c) => c.status === 'ACTIVE' || c.status === 'VIOLATION');
  const openAlerts = alerts.filter((a) => !a.is_resolved)
    .sort((a, b) => b.severity - a.severity);

  // Seed positions for live map
  const initialPositions: LivePosition[] = activeCases
    .filter((c) => c.last_position && c.device)
    .map((c) => ({
      case_id: c.id,
      device_id: c.device!.id,
      case_number: c.case_number,
      status: c.status as CaseStatus,
      alert_count: c.alert_count ?? 0,
      latitude: c.last_position!.latitude,
      longitude: c.last_position!.longitude,
      speed_kmh: c.last_position!.speed_kmh,
      recorded_at: c.last_position!.recorded_at,
    }));

  function formatTimeAgo(iso: string) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}min`;
    return `${Math.floor(m / 60)}h`;
  }

  return (
    <div className="space-y-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Monitoring temps réel</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCases.length} dossier{activeCases.length !== 1 ? 's' : ''} actif{activeCases.length !== 1 ? 's' : ''} ·{' '}
            {openAlerts.length} alerte{openAlerts.length !== 1 ? 's' : ''} en cours
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-white border border-gray-100 rounded-lg px-3 py-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Positions en temps réel
        </div>
      </div>

      {/* Main split layout */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Map — 3/5 width */}
        <div className="xl:col-span-3 space-y-4">
          <div style={{ height: 420 }}>
            <LiveMapGrid initialPositions={initialPositions} />
          </div>

          {/* Device cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeCases.map((c) => (
              <Link
                key={c.id}
                href={`/sigep/dashboard/cases/${c.id}`}
                className="bg-white rounded-xl border border-gray-100 p-3.5 hover:border-blue-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono text-xs font-bold text-gray-800">{c.case_number}</p>
                    <p className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${c.status === 'VIOLATION' ? 'text-red-500' : 'text-green-600'}`}>
                      {c.status}
                    </p>
                  </div>
                  {c.device?.is_online
                    ? <Wifi className="w-4 h-4 text-green-500" />
                    : <WifiOff className="w-4 h-4 text-gray-300" />}
                </div>
                {c.device && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${(c.device.battery_pct ?? 100) <= 20 ? 'bg-red-400' : 'bg-green-400'}`}
                        style={{ width: `${c.device.battery_pct ?? 0}%` }}
                      />
                    </div>
                    <Battery className="w-3 h-3 text-gray-400" />
                    <span className="text-[10px] text-gray-500">{c.device.battery_pct}%</span>
                  </div>
                )}
                {(c.alert_count ?? 0) > 0 && (
                  <div className="mt-1.5 text-[10px] text-red-500 font-semibold">
                    {c.alert_count} alerte{(c.alert_count ?? 0) > 1 ? 's' : ''}
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Right panel — 2/5 width */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          {/* Demo controls */}
          <DemoControls />

          {/* Live alert feed */}
          <div className="bg-white rounded-2xl border border-gray-100 flex-1 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <h3 className="text-sm font-semibold text-gray-900">Alertes actives</h3>
              </div>
              <span className="text-xs text-gray-400">{openAlerts.length} en cours</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {openAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3">
                    <span className="text-green-500 text-lg">✓</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700">Aucune alerte active</p>
                  <p className="text-xs text-gray-400 mt-1">Tous les dispositifs fonctionnent normalement</p>
                </div>
              ) : (
                openAlerts.map((alert) => (
                  <div key={alert.id} className={`px-4 py-3 ${alert.severity >= 5 ? 'bg-red-50/50' : ''}`}>
                    <div className="flex items-start gap-2.5">
                      <SeverityDot level={alert.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <AlertTypeBadge type={alert.alert_type} />
                          {alert.severity >= 4 && (
                            <span className="text-[10px] font-bold text-red-600">
                              CRITIQUE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {alert.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Link
                            href={`/sigep/dashboard/cases/${alert.case_id}`}
                            className="text-[10px] text-blue-500 hover:underline font-mono"
                          >
                            {(alert.case as { case_number?: string } | undefined)?.case_number ?? alert.case_id.slice(0, 8)}
                          </Link>
                          <span className="text-[10px] text-gray-400">
                            {formatTimeAgo(alert.triggered_at)} ago
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
