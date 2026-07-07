import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus, Building2, Users } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { allow, canViewTigSites, canManageTigSites } from '@/lib/auth/permissions';
import { fetchTigSites } from '@/lib/mock/helpers';
import TigSitesList from '@/components/tig/TigSitesList';

export const metadata = { title: 'Sites TIG agréés — SIGEP' };
export const revalidate = 0;

export default async function TigSitesPage() {
  const session = await getSession();
  if (!session || !allow(session, canViewTigSites(session.role), 'tig')) redirect('/sigep/dashboard');

  const canManage = allow(session, canManageTigSites(session.role), 'tig');
  const sites = await fetchTigSites();

  const active   = sites.filter((s) => s.is_active);
  const totalCap = active.reduce((acc, s) => acc + s.capacity, 0);
  const totalOcc = active.reduce((acc, s) => acc + s.current_count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Sites TIG agréés</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Structures d&apos;accueil validées par le tribunal pour l&apos;exécution des Travaux d&apos;Intérêt Général
          </p>
        </div>
        {canManage && (
          <Link
            href="/sigep/dashboard/tig-sites/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors shadow-sm shadow-emerald-200"
          >
            <Plus className="w-4 h-4" /> Nouveau site
          </Link>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Sites actifs',         value: active.length,                                                              color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Capacité totale',      value: totalCap,                                                                   color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-100' },
          { label: 'Bénéficiaires actifs', value: totalOcc,                                                                   color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100' },
          { label: 'Taux d\'occupation',   value: totalCap ? `${Math.round((totalOcc / totalCap) * 100)}%` : '—',             color: 'text-purple-600',  bg: 'bg-purple-50 border-purple-100' },
        ].map((k) => (
          <div key={k.label} className={`border rounded-2xl p-4 ${k.bg}`}>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Sites list with client-side filter */}
      <TigSitesList sites={sites} canManage={canManage} />

      {/* Notice */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 flex items-start gap-3">
        <Building2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">Agrément des sites</p>
          <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
            Tout site doit être préalablement agréé par le Tribunal de Grande Instance compétent. Une convention est signée entre la structure d&apos;accueil et le Ministère de la Justice.
            Les sites sont visités annuellement par un agent SIGEP pour vérifier les conditions d&apos;accueil.
          </p>
        </div>
      </div>
    </div>
  );
}
