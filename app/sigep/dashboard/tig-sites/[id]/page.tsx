import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, Phone, Clock, Users, TreePine,
  Heart, GraduationCap, Landmark, Building2, CheckCircle2,
  CalendarDays, XCircle, BarChart3,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { allow, canViewTigSites, canManageTigSites } from '@/lib/auth/permissions';
import { fetchTigSiteDetail } from '@/lib/mock/helpers';
import type { TigSiteCategory } from '@/lib/supabase/types';

export const revalidate = 0;
export const metadata = { title: 'Détail site TIG — SIGEP' };

const CAT_META: Record<TigSiteCategory, { label: string; icon: typeof TreePine; color: string; bg: string }> = {
  MAIRIE:      { label: 'Mairie / Administration', icon: Landmark,      color: 'text-slate-600',   bg: 'bg-slate-100' },
  HOPITAL:     { label: 'Santé',                   icon: Heart,         color: 'text-red-600',     bg: 'bg-red-50' },
  ECOLE:       { label: 'Éducation',               icon: GraduationCap, color: 'text-blue-600',    bg: 'bg-blue-50' },
  ONG:         { label: 'ONG / Associatif',         icon: Users,         color: 'text-purple-600',  bg: 'bg-purple-50' },
  ESPACE_VERT: { label: 'Espace vert',             icon: TreePine,      color: 'text-emerald-600', bg: 'bg-emerald-50' },
  AUTRE:       { label: 'Autre',                   icon: Building2,     color: 'text-gray-600',    bg: 'bg-gray-100' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE:     { label: 'Actif',    color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  VIOLATION:  { label: 'Violation', color: 'text-red-600 bg-red-50 border-red-100' },
  SUSPENDED:  { label: 'Suspendu', color: 'text-amber-600 bg-amber-50 border-amber-100' },
  TERMINATED: { label: 'Clôturé', color: 'text-gray-500 bg-gray-50 border-gray-100' },
  ARCHIVED:   { label: 'Archivé', color: 'text-gray-400 bg-gray-50 border-gray-100' },
};

export default async function TigSiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || !allow(session, canViewTigSites(session.role), 'tig')) redirect('/sigep/dashboard');

  const { site, cases, attendance } = await fetchTigSiteDetail(id);
  if (!site) notFound();

  const cat    = CAT_META[site.category];
  const CatIcon = cat.icon;
  const hasCoords = site.latitude != null && site.longitude != null;
  const canManage = allow(session, canManageTigSites(session.role), 'tig');

  const activeCases  = cases.filter((c) => ['ACTIVE', 'VIOLATION', 'SUSPENDED'].includes(c.status));
  const closedCases  = cases.filter((c) => ['TERMINATED', 'ARCHIVED'].includes(c.status));
  const totalHours   = attendance.reduce((acc, a) => acc + a.hours_worked, 0);

  // Monthly stats: last 3 months
  const now = new Date();
  const monthlyStats: { label: string; hours: number }[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    const hours = attendance
      .filter((a) => a.session_date.startsWith(prefix))
      .reduce((acc, a) => acc + a.hours_worked, 0);
    monthlyStats.push({ label, hours });
  }
  const maxMonthly = Math.max(...monthlyStats.map((m) => m.hours), 1);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/sigep/dashboard/tig-sites"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux sites TIG
      </Link>

      {/* Site header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${cat.bg}`}>
              <CatIcon className={`w-5 h-5 ${cat.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{site.name}</h2>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${site.is_active ? 'text-emerald-700 bg-emerald-50' : 'text-gray-400 bg-gray-100'}`}>
                  {site.is_active ? <><CheckCircle2 className="w-3 h-3" /> Actif</> : <><XCircle className="w-3 h-3" /> Inactif</>}
                </span>
              </div>
              <span className={`text-xs font-semibold ${cat.color}`}>{cat.label}</span>
            </div>
          </div>
          {canManage && hasCoords && (
            <Link
              href={`/sigep/dashboard/geofences/new?lat=${site.latitude}&lng=${site.longitude}&name=${encodeURIComponent(site.name)}`}
              className="text-xs text-emerald-600 hover:underline font-medium inline-flex items-center gap-1"
            >
              <MapPin className="w-3 h-3" /> Créer géofence
            </Link>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="flex items-start gap-2 text-xs text-gray-500">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{site.address} — {site.arrondissement}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Phone className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{site.contact_name} · {site.contact_phone}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{site.hours}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Users className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Capacité : {site.current_count} / {site.capacity} places</span>
          </div>
          {hasCoords && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-mono">{site.latitude?.toFixed(5)}, {site.longitude?.toFixed(5)}</span>
            </div>
          )}
        </div>
      </div>

      {/* KPIs + Monthly chart */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
          <p className="text-2xl font-bold text-emerald-700">{activeCases.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Bénéficiaires actuels</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-2xl font-bold text-blue-700">{totalHours}h</p>
          <p className="text-xs text-gray-500 mt-0.5">Heures totales effectuées</p>
        </div>
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
          <p className="text-2xl font-bold text-purple-700">{cases.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Dossiers traités (total)</p>
        </div>
      </div>

      {/* Monthly activity */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-blue-500" />
          Activité mensuelle
        </h3>
        <div className="flex items-end gap-4 h-20">
          {monthlyStats.map((m) => (
            <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-semibold text-gray-600">{m.hours > 0 ? `${m.hours}h` : '—'}</span>
              <div className="w-full bg-gray-100 rounded-t-md" style={{ height: '48px' }}>
                <div
                  className="w-full bg-blue-400 rounded-t-md"
                  style={{ height: `${Math.round((m.hours / maxMonthly) * 48)}px` }}
                />
              </div>
              <span className="text-[9px] text-gray-400">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Active beneficiaries */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="font-semibold text-gray-900 text-sm">Bénéficiaires actuels ({activeCases.length})</h3>
        </div>
        {activeCases.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">Aucun bénéficiaire actuellement affecté à ce site.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {activeCases.map((c) => {
              const st = STATUS_LABELS[c.status] ?? { label: c.status, color: 'text-gray-500 bg-gray-50 border-gray-100' };
              const pct = c.tig_hours_ordered
                ? Math.min(100, Math.round((c.tig_hours_completed / c.tig_hours_ordered) * 100))
                : null;
              return (
                <li key={c.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/sigep/dashboard/cases/${c.id}`}
                        className="text-sm font-semibold text-gray-800 hover:text-emerald-700"
                      >
                        {c.individual_name}
                      </Link>
                      <span className="text-xs text-gray-400">#{c.case_number}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${st.color}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">
                        {c.tig_hours_completed}h / {c.tig_hours_ordered ?? '?'}h
                        {pct !== null ? ` (${pct}%)` : ''}
                      </span>
                      {pct !== null && (
                        <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-blue-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Attendance history */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 text-sm">
            Historique des pointages
            {attendance.length > 0 && <span className="font-normal text-gray-400 ml-1">({attendance.length})</span>}
          </h3>
        </div>
        {attendance.length >= 200 && (
          <p className="px-5 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
            Affichage limité aux 200 dernières sessions — les plus anciennes ne sont pas visibles ici.
          </p>
        )}
        {attendance.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">Aucun pointage enregistré pour ce site.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {attendance.map((a) => (
              <li key={a.id} className="px-5 py-3 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Link href={`/sigep/dashboard/cases/${a.case_id}`} className="text-xs font-semibold text-gray-800 hover:text-emerald-700">
                        {a.individual_name}
                      </Link>
                      <span className="text-xs text-gray-400 ml-1">#{a.case_number}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500">
                        {new Date(a.session_date).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="text-xs font-bold text-emerald-700">{a.hours_worked}h</span>
                    </div>
                  </div>
                  {a.supervisor_notes && (
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-tight">{a.supervisor_notes}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Closed/archived cases */}
      {closedCases.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h3 className="font-semibold text-gray-500 text-sm">Dossiers clôturés / archivés ({closedCases.length})</h3>
          </div>
          <ul className="divide-y divide-gray-50">
            {closedCases.map((c) => {
              const st = STATUS_LABELS[c.status] ?? { label: c.status, color: 'text-gray-500 bg-gray-50 border-gray-100' };
              return (
                <li key={c.id} className="px-5 py-2.5 flex items-center gap-3 opacity-60">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-700">{c.individual_name}</span>
                    <span className="text-xs text-gray-400 ml-1.5">#{c.case_number}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{c.tig_hours_completed}h</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
