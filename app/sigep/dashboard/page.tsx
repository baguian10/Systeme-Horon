import { FolderOpen, Bell, Wifi, Users, AlertOctagon } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import { CaseStatusBadge } from '@/components/ui/StatusBadge';
import { AlertTypeBadge, SeverityDot } from '@/components/ui/StatusBadge';
import { fetchOverviewStats, fetchCases, fetchAlerts } from '@/lib/mock/helpers';
import { getSession } from '@/lib/auth/session';
import { canViewPII } from '@/lib/auth/permissions';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const [stats, cases, alerts] = await Promise.all([
    fetchOverviewStats(),
    fetchCases(session.role, session.id),
    fetchAlerts(session.role),
  ]);

  const recentAlerts = alerts.filter((a) => !a.is_resolved).slice(0, 5);
  const activeCases = cases.filter((c) => c.status === 'ACTIVE' || c.status === 'VIOLATION').slice(0, 5);
  const showPII = canViewPII(session.role);

  function formatTimeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 0) return `Il y a ${h}h${m > 0 ? m + 'm' : ''}`;
    return `Il y a ${m}min`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Vue d'ensemble</h2>
        <p className="text-sm text-gray-500 mt-0.5">Tableau de bord en temps réel — {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Dossiers actifs"
          value={stats.active_cases}
          icon={<FolderOpen className="w-5 h-5" />}
          accent="blue"
        />
        <StatCard
          label="Alertes en cours"
          value={stats.active_alerts}
          icon={<Bell className="w-5 h-5" />}
          accent={stats.active_alerts > 0 ? 'red' : 'green'}
        />
        <StatCard
          label="Bracelets en ligne"
          value={stats.devices_online}
          icon={<Wifi className="w-5 h-5" />}
          accent="green"
        />
        <StatCard
          label="En violation"
          value={stats.violation_cases}
          icon={<AlertOctagon className="w-5 h-5" />}
          accent={stats.violation_cases > 0 ? 'orange' : 'green'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Alerts */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Alertes actives</h3>
            <Link href="/sigep/dashboard/alerts" className="text-xs text-blue-600 hover:underline">
              Voir tout
            </Link>
          </div>
          {recentAlerts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucune alerte active</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentAlerts.map((alert) => (
                <li key={alert.id} className="px-5 py-3 flex items-start gap-3">
                  <SeverityDot level={alert.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <AlertTypeBadge type={alert.alert_type} />
                      <span className="text-xs text-gray-400">{formatTimeAgo(alert.triggered_at)}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{alert.description}</p>
                  </div>
                  <Link
                    href={`/sigep/dashboard/cases/${alert.case_id}`}
                    className="text-xs text-blue-500 hover:underline flex-shrink-0"
                  >
                    Dossier
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Active Cases */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Dossiers en cours</h3>
            <Link href="/sigep/dashboard/cases" className="text-xs text-blue-600 hover:underline">
              Voir tout
            </Link>
          </div>
          {activeCases.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun dossier actif</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {activeCases.map((c) => (
                <li key={c.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-gray-700">{c.case_number}</span>
                      <CaseStatusBadge status={c.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {showPII ? (c.individual?.full_name ?? '—') : 'Identité masquée'}
                    </p>
                  </div>
                  {(c.alert_count ?? 0) > 0 && (
                    <span className="flex-shrink-0 bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      {c.alert_count} alerte{(c.alert_count ?? 0) > 1 ? 's' : ''}
                    </span>
                  )}
                  <Link
                    href={`/sigep/dashboard/cases/${c.id}`}
                    className="text-xs text-blue-500 hover:underline flex-shrink-0"
                  >
                    Ouvrir →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
