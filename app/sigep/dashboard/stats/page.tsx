import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewStats, canExportData , allow } from '@/lib/auth/permissions';
import { fetchOverviewStats, fetchCaseStatusCounts, fetchAlertTypeCounts } from '@/lib/mock/helpers';
import type { CaseStatus, AlertType } from '@/lib/supabase/types';

export const metadata = { title: 'Statistiques — SIGEP' };

function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-32 text-right flex-shrink-0">{item.label}</span>
          <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${item.color}`}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-700 w-6">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export default async function StatsPage() {
  const session = await getSession();
  if (!session || !allow(session, canViewStats(session.role), 'stats')) redirect('/sigep/dashboard');

  const canExport = canExportData(session.role);
  // Aggregate, PII-free sources (status/type counts only) — work for both
  // SUPER_ADMIN and STRATEGIC, neither of which has an RLS read on case rows.
  const [stats, statusCounts, alertCounts] = await Promise.all([
    fetchOverviewStats(session.role),
    fetchCaseStatusCounts(),
    fetchAlertTypeCounts(),
  ]);
  const totalCases = Object.values(statusCounts).reduce((s, n) => s + n, 0);

  const STATUS_LABELS: Record<CaseStatus, string> = {
    ACTIVE: 'Actifs', PENDING: 'En attente', SUSPENDED: 'Suspendus',
    TERMINATED: 'Clôturés', VIOLATION: 'En violation', ARCHIVED: 'Archivés',
  };
  const STATUS_COLORS: Record<CaseStatus, string> = {
    ACTIVE: 'bg-green-400', PENDING: 'bg-yellow-400', SUSPENDED: 'bg-gray-400',
    TERMINATED: 'bg-slate-300', VIOLATION: 'bg-red-500', ARCHIVED: 'bg-gray-300',
  };

  const casesByStatus = (Object.keys(STATUS_LABELS) as CaseStatus[]).map((s) => ({
    label: STATUS_LABELS[s],
    value: statusCounts[s] ?? 0,
    color: STATUS_COLORS[s],
  }));

  const ALERT_LABELS: Partial<Record<AlertType, string>> = {
    GEOFENCE_EXIT: 'Sortie zone', TAMPER_DETECTED: 'Sabotage',
    HEALTH_CRITICAL: 'Santé', BATTERY_LOW: 'Batterie', SIGNAL_LOST: 'Signal',
  };
  const alertsByType = (Object.keys(ALERT_LABELS) as AlertType[]).map((t) => ({
    label: ALERT_LABELS[t]!,
    value: alertCounts.byType[t] ?? 0,
    color: t === 'TAMPER_DETECTED' ? 'bg-red-500' : t === 'GEOFENCE_EXIT' ? 'bg-orange-400' : 'bg-blue-400',
  }));

  const resolvedRate = alertCounts.total > 0
    ? Math.round((alertCounts.resolved / alertCounts.total) * 100)
    : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Statistiques globales</h2>
          <p className="text-sm text-gray-500 mt-0.5">Agrégats — aucune donnée nominative</p>
        </div>
        {canExport && (
          <Link
            href="/api/export/cases"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exporter CSV
          </Link>
        )}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total dossiers', value: totalCases, bg: 'bg-blue-50', text: 'text-blue-700' },
          { label: 'Dossiers actifs', value: stats.active_cases, bg: 'bg-green-50', text: 'text-green-700' },
          { label: 'Total alertes', value: alertCounts.total, bg: 'bg-orange-50', text: 'text-orange-700' },
          { label: 'Taux résolution', value: `${resolvedRate}%`, bg: 'bg-emerald-50', text: 'text-emerald-700' },
        ].map((t) => (
          <div key={t.label} className={`${t.bg} rounded-2xl p-5 text-center`}>
            <p className={`text-3xl font-bold ${t.text}`}>{t.value}</p>
            <p className="text-xs text-gray-500 mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cases by status */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Dossiers par statut</h3>
          <BarChart data={casesByStatus} />
        </div>

        {/* Alerts by type */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Alertes par type</h3>
          <BarChart data={alertsByType} />
        </div>
      </div>

      {/* Device uptime */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Performance des dispositifs</h3>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.devices_online}</p>
            <p className="text-xs text-gray-500">Bracelets en ligne</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {stats.devices_online > 0 ? Math.round((stats.devices_online / Math.max(stats.active_cases, 1)) * 100) : 0}%
            </p>
            <p className="text-xs text-gray-500">Taux de disponibilité</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.violation_cases}</p>
            <p className="text-xs text-gray-500">Violations détectées</p>
          </div>
        </div>
      </div>
    </div>
  );
}
