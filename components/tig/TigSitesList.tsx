'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  TreePine, MapPin, Phone, Users, Clock,
  Heart, GraduationCap, Landmark, Building2, Search,
} from 'lucide-react';
import EditTigSiteButton from './EditTigSiteButton';
import DeleteTigSiteButton from './DeleteTigSiteButton';
import ToggleTigSiteButton from './ToggleTigSiteButton';
import type { TigSite, TigSiteCategory } from '@/lib/supabase/types';

const CAT_META: Record<TigSiteCategory, { label: string; icon: typeof TreePine; color: string; bg: string }> = {
  MAIRIE:      { label: 'Mairie / Administration', icon: Landmark,      color: 'text-slate-600',   bg: 'bg-slate-100' },
  HOPITAL:     { label: 'Santé',                   icon: Heart,         color: 'text-red-600',     bg: 'bg-red-50' },
  ECOLE:       { label: 'Éducation',               icon: GraduationCap, color: 'text-blue-600',    bg: 'bg-blue-50' },
  ONG:         { label: 'ONG / Associatif',         icon: Users,         color: 'text-purple-600',  bg: 'bg-purple-50' },
  ESPACE_VERT: { label: 'Espace vert',             icon: TreePine,      color: 'text-emerald-600', bg: 'bg-emerald-50' },
  AUTRE:       { label: 'Autre',                   icon: Building2,     color: 'text-gray-600',    bg: 'bg-gray-100' },
};

const CATEGORIES: { value: TigSiteCategory; label: string }[] = [
  { value: 'MAIRIE',      label: 'Mairie / Admin' },
  { value: 'HOPITAL',     label: 'Santé' },
  { value: 'ECOLE',       label: 'Éducation' },
  { value: 'ONG',         label: 'ONG' },
  { value: 'ESPACE_VERT', label: 'Espace vert' },
  { value: 'AUTRE',       label: 'Autre' },
];

interface Props {
  sites: TigSite[];
  canManage: boolean;
}

export default function TigSitesList({ sites, canManage }: Props) {
  const [query,        setQuery]        = useState('');
  const [catFilter,    setCatFilter]    = useState<TigSiteCategory | ''>('');
  const [showInactive, setShowInactive] = useState(false);

  const q = query.toLowerCase();
  const filtered = sites.filter((s) => {
    if (!showInactive && !s.is_active) return false;
    if (catFilter && s.category !== catFilter) return false;
    if (q && !s.name.toLowerCase().includes(q) && !s.arrondissement.toLowerCase().includes(q) && !s.address.toLowerCase().includes(q)) return false;
    return true;
  });

  const active   = filtered.filter((s) => s.is_active);
  const inactive = filtered.filter((s) => !s.is_active);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="search"
            placeholder="Rechercher un site…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value as TigSiteCategory | '')}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button
          onClick={() => setShowInactive((v) => !v)}
          className={`text-xs px-3 py-2 rounded-xl border transition-colors ${showInactive ? 'bg-gray-100 border-gray-300 text-gray-700' : 'border-gray-200 text-gray-400 hover:text-gray-600'}`}
        >
          {showInactive ? 'Masquer inactifs' : 'Voir inactifs'}
        </button>
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
          <p className="px-5 py-10 text-sm text-gray-400 text-center">
            {query || catFilter ? 'Aucun site ne correspond aux filtres.' : 'Aucun site actif'}
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {active.map((site) => <SiteCard key={site.id} site={site} canManage={canManage} />)}
          </div>
        )}
      </div>

      {/* Inactive sites */}
      {showInactive && inactive.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-500 text-sm">Sites inactifs ({inactive.length})</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {inactive.map((site) => {
              const cat  = CAT_META[site.category];
              const Icon = cat.icon;
              return (
                <li key={site.id} className="px-5 py-3 flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center opacity-50 ${cat.bg}`}>
                    <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                  </div>
                  <div className="flex-1 min-w-0 opacity-60">
                    <Link href={`/sigep/dashboard/tig-sites/${site.id}`} className="text-sm text-gray-700 hover:underline truncate block">
                      {site.name}
                    </Link>
                    <p className="text-xs text-gray-400">{site.address}</p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <EditTigSiteButton site={site} />
                      <DeleteTigSiteButton id={site.id} name={site.name} />
                      <ToggleTigSiteButton siteId={site.id} siteName={site.name} isActive={site.is_active} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function SiteCard({ site, canManage }: { site: TigSite; canManage: boolean }) {
  const cat  = CAT_META[site.category];
  const Icon = cat.icon;
  const occ  = site.capacity > 0 ? Math.round((site.current_count / site.capacity) * 100) : 0;
  const occColor = occ >= 90 ? 'bg-red-400' : occ >= 60 ? 'bg-amber-400' : 'bg-emerald-400';
  const hasCoords = site.latitude != null && site.longitude != null;

  return (
    <div className="p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.bg}`}>
            <Icon className={`w-4 h-4 ${cat.color}`} />
          </div>
          <div>
            <Link href={`/sigep/dashboard/tig-sites/${site.id}`} className="text-sm font-semibold text-gray-900 hover:text-emerald-700 leading-tight">
              {site.name}
            </Link>
            <div>
              <span className={`text-[10px] font-bold ${cat.color}`}>{cat.label}</span>
            </div>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            <EditTigSiteButton site={site} />
            <DeleteTigSiteButton id={site.id} name={site.name} />
            <ToggleTigSiteButton siteId={site.id} siteName={site.name} isActive={site.is_active} />
          </div>
        )}
      </div>

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
          <div className={`h-full rounded-full transition-all ${occColor}`} style={{ width: `${Math.min(100, occ)}%` }} />
        </div>
      </div>

      {hasCoords && (
        <Link
          href={`/sigep/dashboard/geofences/new?lat=${site.latitude}&lng=${site.longitude}&name=${encodeURIComponent(site.name)}`}
          className="text-[10px] text-emerald-600 hover:underline font-medium inline-flex items-center gap-1 w-fit"
        >
          <MapPin className="w-3 h-3" />
          Créer la géofence pour ce site
        </Link>
      )}
    </div>
  );
}
