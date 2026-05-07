import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  TreePine, MapPin, Phone, Users, Clock,
  Plus, CheckCircle, XCircle, Building2,
  Heart, GraduationCap, Wrench, Landmark,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewTigSites, canManageTigSites } from '@/lib/auth/permissions';
import { fetchTigSites } from '@/lib/mock/helpers';
import { toggleTigSiteAction } from './actions';
import type { TigSiteCategory } from '@/lib/supabase/types';

export const metadata = { title: 'Sites TIG agréés — SIGEP' };
export const revalidate = 0;

const CAT_META: Record<TigSiteCategory, { label: string; icon: typeof TreePine; color: string; bg: string }> = {
  MAIRIE:      { label: 'Mairie / Administration', icon: Landmark,      color: 'text-slate-600',   bg: 'bg-slate-100' },
  HOPITAL:     { label: 'Santé',                   icon: Heart,         color: 'text-red-600',     bg: 'bg-red-50' },
  ECOLE:       { label: 'Éducation',               icon: GraduationCap, color: 'text-blue-600',    bg: 'bg-blue-50' },
  ONG:         { label: 'ONG / Associatif',         icon: Users,         color: 'text-purple-600',  bg: 'bg-purple-50' },
  ESPACE_VERT: { label: 'Espace vert',             icon: TreePine,      color: 'text-emerald-600', bg: 'bg-emerald-50' },
  AUTRE:       { label: 'Autre',                   icon: Building2,     color: 'text-gray-600',    bg: 'bg-gray-100' },
};

export default async function TigSitesPage() {
  const session = await getSession();
  if (!session || !canViewTigSites(session.role)) redirect('/sigep/dashboard');

  const canManage = canManageTigSites(session.role);
  const sites = await fetchTigSites();

  const active   = sites.filter((s) => s.is_active);
  const inactive = sites.filter((s) => !s.is_active);
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
          { label: 'Sites actifs',         value: active.length,   color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Capacité totale',      value: totalCap,        color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-100' },
          { label: 'Bénéficiaires actifs', value: totalOcc,        color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100' },
          { label: 'Taux d\'occupation',   value: totalCap ? `${Math.round((totalOcc / totalCap) * 100)}%` : '—', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
        ].map((k) => (
          <div key={k.label} className={`border rounded-2xl p-4 ${k.bg}`}>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Active sites */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">Sites opérationnels ({active.length})</h3>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Actifs
          </div>
        </div>

        {active.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-400 text-center">Aucun site actif</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x md:grid-rows-[auto]">
            {active.map((site) => {
              const cat  = CAT_META[site.category];
              const Icon = cat.icon;
              const occ  = site.capacity > 0 ? Math.round((site.current_count / site.capacity) * 100) : 0;
              const occColor = occ >= 90 ? 'bg-red-400' : occ >= 60 ? 'bg-amber-400' : 'bg-emerald-400';

              return (
                <div key={site.id} className="p-5 flex flex-col gap-3 border-b border-gray-50 last:border-b-0">
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.bg}`}>
                        <Icon className={`w-4 h-4 ${cat.color}`} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 leading-tight">{site.name}</h4>
                        <span className={`text-[10px] font-bold ${cat.color}`}>{cat.label}</span>
                      </div>
                    </div>
                    {canManage && (
                      <form action={toggleTigSiteAction}>
                        <input type="hidden" name="site_id" value={site.id} />
                        <input type="hidden" name="is_active" value={String(site.is_active)} />
                        <button type="submit" title="Désactiver" className="text-gray-300 hover:text-red-400 transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{site.address} — {site.arrondissement}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      <span>{site.contact_name} · {site.contact_phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span>{site.hours}</span>
                    </div>
                  </div>

                  {/* Capacity bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Users className="w-3 h-3" /> Occupation
                      </span>
                      <span className="text-[10px] font-semibold text-gray-600">
                        {site.current_count}/{site.capacity} places
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${occColor}`} style={{ width: `${occ}%` }} />
                    </div>
                  </div>

                  {/* Create geofence link */}
                  <Link
                    href={`/sigep/dashboard/geofences/new?lat=${site.latitude}&lng=${site.longitude}&name=${encodeURIComponent(site.name)}`}
                    className="text-[10px] text-emerald-600 hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3" />
                    Créer la géofence pour ce site
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inactive sites */}
      {inactive.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-500 text-sm">Sites inactifs ({inactive.length})</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {inactive.map((site) => {
              const cat  = CAT_META[site.category];
              const Icon = cat.icon;
              return (
                <li key={site.id} className="px-5 py-3 flex items-center gap-3 opacity-60">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cat.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{site.name}</p>
                    <p className="text-xs text-gray-400">{site.address}</p>
                  </div>
                  {canManage && (
                    <form action={toggleTigSiteAction}>
                      <input type="hidden" name="site_id" value={site.id} />
                      <input type="hidden" name="is_active" value={String(site.is_active)} />
                      <button type="submit" className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Réactiver
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
