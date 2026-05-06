import { Bell, CheckCircle } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { fetchAlerts } from '@/lib/mock/helpers';
import { AlertTypeBadge, SeverityDot } from '@/components/ui/StatusBadge';
import { canResolveAlert } from '@/lib/auth/permissions';
import EmptyState from '@/components/ui/EmptyState';
import Link from 'next/link';
import { resolveAlertAction } from './actions';

export const metadata = { title: 'Alertes — SIGEP' };

export default async function AlertsPage() {
  const session = await getSession();
  if (!session) return null;

  const alerts = await fetchAlerts(session.role);
  const canResolve = canResolveAlert(session.role);

  const open = alerts.filter((a) => !a.is_resolved);
  const resolved = alerts.filter((a) => a.is_resolved);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  const SEVERITY_LABEL = ['', 'Faible', 'Modéré', 'Élevé', 'Critique', 'Maximal'];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Centre d'alertes</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {open.length} alerte{open.length !== 1 ? 's' : ''} active{open.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Open alerts */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="font-semibold text-gray-900">Alertes en cours</h3>
        </div>
        {open.length === 0 ? (
          <EmptyState
            icon={<Bell className="w-6 h-6" />}
            title="Aucune alerte active"
            description="Tous les dispositifs fonctionnent normalement."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-4">Sév.</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dossier</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Déclenchée</th>
                  {canResolve && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {open.sort((a, b) => b.severity - a.severity).map((alert) => (
                  <tr key={alert.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <SeverityDot level={alert.severity} />
                        <span className="text-xs text-gray-500">{SEVERITY_LABEL[alert.severity]}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <AlertTypeBadge type={alert.alert_type} />
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <p className="text-xs text-gray-600 line-clamp-2">{alert.description ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/sigep/dashboard/cases/${alert.case_id}`}
                        className="text-xs text-blue-600 hover:underline font-mono"
                      >
                        {alert.case?.case_number ?? alert.case_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(alert.triggered_at)}
                    </td>
                    {canResolve && (
                      <td className="px-5 py-3.5 text-right">
                        <form action={resolveAlertAction}>
                          <input type="hidden" name="alertId" value={alert.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Résoudre
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resolved alerts */}
      {resolved.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-600">Alertes résolues ({resolved.length})</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {resolved.map((alert) => (
              <li key={alert.id} className="px-5 py-3 flex items-center gap-3 opacity-60">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <AlertTypeBadge type={alert.alert_type} />
                <p className="text-xs text-gray-500 flex-1 truncate">{alert.description}</p>
                <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(alert.triggered_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
