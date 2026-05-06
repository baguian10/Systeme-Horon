import { Suspense } from 'react';
import Link from 'next/link';
import { FolderOpen, Plus, Battery, Wifi, WifiOff } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { fetchCases } from '@/lib/mock/helpers';
import { CaseStatusBadge } from '@/components/ui/StatusBadge';
import { canCreateCase, canViewPII } from '@/lib/auth/permissions';
import EmptyState from '@/components/ui/EmptyState';
import CaseSearch from '@/components/cases/CaseSearch';
import type { CaseStatus } from '@/lib/supabase/types';

export const metadata = { title: 'Dossiers — SIGEP' };

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const [{ q = '', status = '' }, session] = await Promise.all([searchParams, getSession()]);
  if (!session) return null;

  const cases = await fetchCases(session.role, session.id);
  const showPII = canViewPII(session.role);
  const canCreate = canCreateCase(session.role);

  const filtered = cases.filter((c) => {
    const matchQ = !q || c.case_number.toLowerCase().includes(q.toLowerCase()) ||
      (showPII && c.individual?.full_name.toLowerCase().includes(q.toLowerCase()));
    const matchStatus = !status || c.status === (status as CaseStatus);
    return matchQ && matchStatus;
  });

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return (
    <div className="space-y-5">
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
            description={cases.length > 0 ? 'Aucun dossier ne correspond à votre recherche.' : 'Aucun dossier ne vous est assigné pour le moment.'}
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
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Alertes</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => (
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
                      <CaseStatusBadge status={c.status} />
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
                      <Link
                        href={`/sigep/dashboard/cases/${c.id}`}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        Ouvrir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
