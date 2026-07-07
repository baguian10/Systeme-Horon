import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FolderOpen, Plus, Battery, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { fetchCases } from '@/lib/mock/helpers';
import { CaseStatusBadge, RiskBadge } from '@/components/ui/StatusBadge';
import { canCreateCase, canViewPII, canViewCases, allow } from '@/lib/auth/permissions';
import EmptyState from '@/components/ui/EmptyState';
import CaseSearch from '@/components/cases/CaseSearch';
import AutoRefresh from '@/components/common/AutoRefresh';
import type { CaseStatus, RiskLevel } from '@/lib/supabase/types';

export const metadata = { title: 'Dossiers — SIGEP' };
export const revalidate = 0;

const RISK_ORDER: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function isExpiringSoon(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const daysLeft = (Date.parse(iso) - Date.now()) / 86_400_000;
  return daysLeft >= 0 && daysLeft <= 7;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    timeZone: 'Africa/Ouagadougou', day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; risk?: string; sort?: string }>;
}) {
  const [{ q = '', status = '', risk = '', sort = '' }, session] = await Promise.all([
    searchParams, getSession(),
  ]);
  if (!session) return null;
  if (!allow(session, canViewCases(session.role), 'cases.viewAll')) redirect('/sigep/dashboard');

  const cases = await fetchCases(session.role, session.id);
  const showPII   = canViewPII(session.role);
  const canCreate = canCreateCase(session.role);

  let filtered = cases.filter((c) => {
    const matchQ = !q
      || c.case_number.toLowerCase().includes(q.toLowerCase())
      || (showPII && c.individual?.full_name.toLowerCase().includes(q.toLowerCase()));
    const matchStatus = !status || c.status === (status as CaseStatus);
    const matchRisk   = !risk   || c.risk_level === (risk as RiskLevel);
    return matchQ && matchStatus && matchRisk;
  });

  if (sort === 'risk') {
    filtered = [...filtered].sort((a, b) =>
      (RISK_ORDER[b.risk_level ?? ''] ?? 0) - (RISK_ORDER[a.risk_level ?? ''] ?? 0)
    );
  } else if (sort === 'alerts') {
    filtered = [...filtered].sort((a, b) => (b.alert_count ?? 0) - (a.alert_count ?? 0));
  } else if (sort === 'end') {
    filtered = [...filtered].sort((a, b) => {
      if (!a.end_date) return 1;
      if (!b.end_date) return -1;
      return Date.parse(a.end_date) - Date.parse(b.end_date);
    });
  }

  return (
    <div className="space-y-5">
      <AutoRefresh intervalMs={20000} />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Dossiers</h2>
          <p className="text-sm text-gray-500 mt-0.5">{cases.length} dossier{cases.length !== 1 ? 's' : ''} au total</p>
        </div>
        {canCreate && (
          <Link
            href="/sigep/dashboard/cases/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau dossier
          </Link>
        )}
      </div>

      <Suspense>
        <CaseSearch total={filtered.length} />
      </Suspense>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="w-6 h-6" />}
            title="Aucun dossier"
            description={cases.length > 0
              ? 'Aucun dossier ne correspond à votre recherche.'
              : 'Aucun dossier ne vous est assigné pour le moment.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dossier</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Individu</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Juge</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Bracelet</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Début</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fin</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Alertes</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => {
                  const expiringSoon = isExpiringSoon(c.end_date);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-semibold text-gray-800 text-xs">{c.case_number}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {showPII ? (
                          <span className="text-gray-900 font-medium">{c.individual?.full_name ?? '—'}</span>
                        ) : (
                          <span className="text-gray-400 italic text-xs">Masqué</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1 items-start">
                          <CaseStatusBadge status={c.status} />
                          <RiskBadge level={c.risk_level} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 text-xs">{c.judge?.full_name ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        {c.device ? (
                          <div className="flex items-center gap-1.5">
                            {c.device.is_online
                              ? <Wifi className="w-3.5 h-3.5 text-green-500" />
                              : <WifiOff className="w-3.5 h-3.5 text-gray-400" />}
                            <span className="text-xs text-gray-500">{c.device.battery_pct}%</span>
                            <Battery className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">{formatDate(c.start_date)}</td>
                      <td className="px-5 py-3.5 text-xs">
                        {c.end_date ? (
                          <span className={`flex items-center gap-1 ${expiringSoon ? 'text-amber-600 font-semibold' : 'text-gray-500'}`}>
                            {expiringSoon && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                            {formatDate(c.end_date)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {(c.alert_count ?? 0) > 0 ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                            {c.alert_count}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/sigep/dashboard/cases/${c.id}`} className="text-xs text-blue-600 hover:underline font-medium">
                          Ouvrir →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
