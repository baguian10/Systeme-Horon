import { getSession } from '@/lib/auth/session';
import { fetchAlerts, fetchOperationalUsers } from '@/lib/mock/helpers';
import { canResolveAlert } from '@/lib/auth/permissions';
import AutoRefresh from '@/components/common/AutoRefresh';
import AlertsClient from '@/components/alerts/AlertsClient';

export const metadata = { title: 'Alertes — SIGEP' };
export const revalidate = 0;

export default async function AlertsPage() {
  const session = await getSession();
  if (!session) return null;

  const [alerts, operationals] = await Promise.all([
    fetchAlerts(session.role),
    fetchOperationalUsers().catch(() => []),
  ]);
  const canResolve = canResolveAlert(session.role);
  const userOpts = (operationals ?? []).map((u) => ({ id: u.id, full_name: u.full_name }));

  const open     = alerts.filter((a) => !a.is_resolved);
  const resolved = alerts.filter((a) => a.is_resolved);

  // KPIs (server-side, deterministic)
  const critical    = open.filter((a) => a.severity >= 4).length;
  const pendingAck  = open.filter((a) => a.status === 'NEW' || !a.status).length;
  const avgAgeMin   = open.length
    ? Math.round(open.reduce((s, a) => s + (Date.now() - Date.parse(a.triggered_at)) / 60_000, 0) / open.length)
    : null;
  const avgAgeLabel = avgAgeMin === null ? '—'
    : avgAgeMin < 60 ? `${avgAgeMin}min`
    : `${Math.floor(avgAgeMin / 60)}h${avgAgeMin % 60 ? String(avgAgeMin % 60).padStart(2, '0') : ''}`;

  const kpis = [
    { label: 'Actives',         value: String(open.length),  cls: open.length > 0 ? 'text-gray-900' : 'text-emerald-600' },
    { label: 'Critiques (≥4)',  value: String(critical),     cls: critical > 0    ? 'text-red-600'   : 'text-gray-400' },
    { label: 'En attente ACK',  value: String(pendingAck),   cls: pendingAck > 0  ? 'text-amber-600' : 'text-gray-400' },
    { label: 'Âge moyen',       value: avgAgeLabel,          cls: 'text-gray-700' },
  ];

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={15000} />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Centre d&apos;alertes</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {open.length} alerte{open.length !== 1 ? 's' : ''} active{open.length !== 1 ? 's' : ''}
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/export/alerts"
          className="inline-flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-700"
        >
          ⬇️ Exporter CSV
        </a>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <AlertsClient open={open} resolved={resolved} canResolve={canResolve} users={userOpts} />
    </div>
  );
}
