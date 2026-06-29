import { Bell, CheckCircle } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { fetchAlerts, fetchOperationalUsers } from '@/lib/mock/helpers';
import { AlertTypeBadge, SeverityDot } from '@/components/ui/StatusBadge';
import { canResolveAlert } from '@/lib/auth/permissions';
import EmptyState from '@/components/ui/EmptyState';
import Link from 'next/link';
import AlertActions from '@/components/alerts/AlertActions';
import type { AlertStatus } from '@/lib/supabase/types';

export const metadata = { title: 'Alertes — SIGEP' };

const STATUS_META: Record<AlertStatus, { label: string; cls: string }> = {
  NEW:          { label: 'Nouvelle',    cls: 'bg-red-100 text-red-700' },
  ACKNOWLEDGED: { label: 'Vue',         cls: 'bg-amber-100 text-amber-700' },
  IN_PROGRESS:  { label: 'En cours',    cls: 'bg-blue-100 text-blue-700' },
  RESOLVED:     { label: 'Traitée',     cls: 'bg-emerald-100 text-emerald-700' },
  FALSE_ALARM:  { label: 'Fausse',      cls: 'bg-gray-100 text-gray-600' },
};

export default async function AlertsPage() {
  const session = await getSession();
  if (!session) return null;

  const [alerts, operationals] = await Promise.all([
    fetchAlerts(session.role),
    fetchOperationalUsers().catch(() => []),
  ]);
  const canResolve = canResolveAlert(session.role);
  const userOpts = (operationals ?? []).map((u) => ({ id: u.id, full_name: u.full_name }));
  const nameOf = (id?: string | null) => userOpts.find((u) => u.id === id)?.full_name ?? null;

  const open = alerts.filter((a) => !a.is_resolved);
  const resolved = alerts.filter((a) => a.is_resolved);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
  const SEVERITY_LABEL = ['', 'Faible', 'Modéré', 'Élevé', 'Critique', 'Maximal'];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Centre d&apos;alertes</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {open.length} alerte{open.length !== 1 ? 's' : ''} active{open.length !== 1 ? 's' : ''}
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from an API route */}
        <a href="/api/export/alerts" data-tip="Exporter l'historique des alertes (type, gravité, statut, motif de clôture) en CSV" className="inline-flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-700">
          ⬇️ Exporter CSV
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="font-semibold text-gray-900">Alertes en cours</h3>
        </div>
        {open.length === 0 ? (
          <EmptyState icon={<Bell className="w-6 h-6" />} title="Aucune alerte active" description="Tous les dispositifs fonctionnent normalement." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-4">Sév.</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dossier</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Déclenchée</th>
                  {canResolve && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {open.sort((a, b) => b.severity - a.severity).map((alert) => {
                  const st = (alert.status ?? 'NEW') as AlertStatus;
                  const meta = STATUS_META[st] ?? STATUS_META.NEW;
                  const assignee = nameOf(alert.assigned_to);
                  return (
                    <tr key={alert.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <SeverityDot level={alert.severity} />
                          <span className="text-xs text-gray-500">{SEVERITY_LABEL[alert.severity]}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5"><AlertTypeBadge type={alert.alert_type} /></td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${meta.cls}`}>{meta.label}</span>
                        {assignee && <div className="text-[11px] text-gray-400 mt-0.5">→ {assignee}</div>}
                      </td>
                      <td className="px-5 py-3.5 max-w-xs"><p className="text-xs text-gray-600 line-clamp-2">{alert.description ?? '—'}</p></td>
                      <td className="px-5 py-3.5">
                        <Link href={`/sigep/dashboard/cases/${alert.case_id}`} className="text-xs text-blue-600 hover:underline font-mono">
                          {alert.case?.case_number ?? alert.case_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">{formatDate(alert.triggered_at)}</td>
                      {canResolve && (
                        <td className="px-5 py-3.5">
                          <AlertActions alertId={alert.id} status={st} assignedTo={alert.assigned_to ?? null} users={userOpts} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resolved.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-600">Alertes clôturées ({resolved.length})</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {resolved.map((alert) => {
              const st = (alert.status ?? 'RESOLVED') as AlertStatus;
              const meta = STATUS_META[st] ?? STATUS_META.RESOLVED;
              return (
                <li key={alert.id} className="px-5 py-3 flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <AlertTypeBadge type={alert.alert_type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 truncate">{alert.description}</p>
                    {alert.resolution_reason && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        <span className={`inline-block px-1.5 rounded ${meta.cls}`}>{meta.label}</span> — {alert.resolution_reason}
                        {nameOf(alert.resolved_by) && <> · par {nameOf(alert.resolved_by)}</>}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(alert.resolved_at ?? alert.triggered_at)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
