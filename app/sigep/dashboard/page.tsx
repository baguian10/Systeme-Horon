import { TrendingUp, Users, Wrench, Calendar, AlertOctagon } from 'lucide-react';
import { CaseStatusBadge } from '@/components/ui/StatusBadge';
import { AlertTypeBadge, SeverityDot } from '@/components/ui/StatusBadge';
import AnimatedKPIGrid from '@/components/dashboard/AnimatedKPIGrid';
import LiveRadarDot from '@/components/dashboard/LiveRadarDot';
import {
  fetchOverviewStats, fetchCases, fetchAlerts, fetchUsers,
  fetchAgenda, fetchMaintenanceTickets, fetchRevocations,
} from '@/lib/mock/helpers';
import { getSession } from '@/lib/auth/session';
import { canViewPII, canViewMaintenance, canViewRevocations } from '@/lib/auth/permissions';
import Link from 'next/link';
import type { UserRole } from '@/lib/supabase/types';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const [stats, cases, alerts, agenda] = await Promise.all([
    fetchOverviewStats(),
    fetchCases(session.role, session.id),
    fetchAlerts(session.role),
    fetchAgenda(session.role, session.id),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const todayObs = agenda.filter((a) => a.scheduled_date === today);
  const recentAlerts = alerts.filter((a) => !a.is_resolved).slice(0, 5);
  const activeCases = cases.filter((c) => c.status === 'ACTIVE' || c.status === 'VIOLATION').slice(0, 5);
  const showPII = canViewPII(session.role);
  const role: UserRole = session.role;

  function formatTimeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 0) return `Il y a ${h}h${m > 0 ? m + 'm' : ''}`;
    return `Il y a ${m}min`;
  }

  const OBL_COLORS: Record<string, string> = {
    TIG_SHIFT:       'bg-emerald-100 text-emerald-700',
    CURFEW_CHECK:    'bg-blue-100 text-blue-700',
    COURT_DATE:      'bg-purple-100 text-purple-700',
    MONITORING_VISIT:'bg-amber-100 text-amber-700',
  };
  const OBL_LABELS: Record<string, string> = {
    TIG_SHIFT:       'TIG',
    CURFEW_CHECK:    'Couvre-feu',
    COURT_DATE:      'Audience',
    MONITORING_VISIT:'Visite',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Vue d&apos;ensemble</h2>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <LiveRadarDot color="green" label="Système actif" />
          </div>
        </div>
        {role === 'STRATEGIC' && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            Vue agrégée — données anonymisées
          </span>
        )}
      </div>

      {/* KPI Cards — staggered animation */}
      <AnimatedKPIGrid
        active_cases={stats.active_cases}
        active_alerts={stats.active_alerts}
        devices_online={stats.devices_online}
        violation_cases={stats.violation_cases}
      />

      {/* STRATEGIC: aggregate-only view */}
      {role === 'STRATEGIC' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Répartition par statut</p>
            {(['ACTIVE','VIOLATION','SUSPENDED','TERMINATED'] as const).map((s) => {
              const count = cases.filter((c) => c.status === s).length;
              return (
                <div key={s} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <CaseStatusBadge status={s} />
                  <span className="text-sm font-bold text-gray-700">{count}</span>
                </div>
              );
            })}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Taux de conformité</p>
            <p className="text-4xl font-bold text-emerald-600 mb-1">
              {stats.active_cases > 0
                ? `${Math.round(((stats.active_cases - stats.violation_cases) / stats.active_cases) * 100)}%`
                : '—'}
            </p>
            <p className="text-xs text-gray-500">Dossiers sans violation active</p>
            <div className="mt-3 h-2 bg-gray-100 rounded-full">
              <div
                className="h-full bg-emerald-400 rounded-full"
                style={{ width: stats.active_cases > 0 ? `${Math.round(((stats.active_cases - stats.violation_cases) / stats.active_cases) * 100)}%` : '0%' }}
              />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Alertes par type</p>
            {(['GEOFENCE_EXIT','TAMPER_DETECTED','BATTERY_LOW','SIGNAL_LOST'] as const).map((t) => {
              const count = alerts.filter((a) => a.alert_type === t).length;
              const labels: Record<string, string> = { GEOFENCE_EXIT: 'Sortie zone', TAMPER_DETECTED: 'Anti-sabotage', BATTERY_LOW: 'Batterie', SIGNAL_LOST: 'Signal perdu' };
              return (
                <div key={t} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0 text-sm">
                  <span className="text-gray-600">{labels[t]}</span>
                  <span className="font-semibold text-gray-800">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Non-STRATEGIC: operational view */}
      {role !== 'STRATEGIC' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's agenda */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-100/80 overflow-hidden shadow-lg shadow-black/5">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <h3 className="font-semibold text-gray-900">Obligations du jour</h3>
              </div>
              <Link href="/sigep/dashboard/agenda" className="text-xs text-blue-600 hover:underline">Agenda →</Link>
            </div>
            {todayObs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Aucune obligation aujourd&apos;hui</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {todayObs.map((ob) => (
                  <li key={ob.id} className="px-5 py-3 flex items-center gap-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${OBL_COLORS[ob.obligation_type]}`}>
                      {OBL_LABELS[ob.obligation_type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{ob.title}</p>
                      <p className="text-xs text-gray-400">
                        {ob.start_time} {ob.end_time ? `– ${ob.end_time}` : ''} · {showPII ? ob.individual_name : ob.case_number}
                      </p>
                    </div>
                    {!ob.is_confirmed && (
                      <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">À confirmer</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Active Alerts */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-100/80 overflow-hidden shadow-lg shadow-black/5">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Alertes actives</h3>
              <Link href="/sigep/dashboard/alerts" className="text-xs text-blue-600 hover:underline">Voir tout</Link>
            </div>
            {recentAlerts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Aucune alerte active</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {recentAlerts.map((alert) => (
                  <li key={alert.id} className="px-5 py-3 flex items-start gap-3">
                    <SeverityDot level={alert.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <AlertTypeBadge type={alert.alert_type} />
                        <span className="text-xs text-gray-400">{formatTimeAgo(alert.triggered_at)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{alert.description}</p>
                    </div>
                    <Link href={`/sigep/dashboard/cases/${alert.case_id}`} className="text-xs text-blue-500 hover:underline flex-shrink-0">
                      Dossier
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Active Cases — hidden for STRATEGIC */}
      {role !== 'STRATEGIC' && (
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-100/80 overflow-hidden shadow-lg shadow-black/5">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              {role === 'OPERATIONAL' ? 'Mes missions actives' : 'Dossiers en cours'}
            </h3>
            <Link href="/sigep/dashboard/cases" className="text-xs text-blue-600 hover:underline">Voir tout</Link>
          </div>
          {activeCases.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Aucun dossier actif</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {activeCases.map((c) => (
                <li key={c.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-gray-700">{c.case_number}</span>
                      <CaseStatusBadge status={c.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {showPII ? (c.individual?.full_name ?? '—') : 'Identité masquée'}
                    </p>
                  </div>
                  {(c.alert_count ?? 0) > 0 && (
                    <span className="flex-shrink-0 bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      {c.alert_count} alerte{(c.alert_count ?? 0) > 1 ? 's' : ''}
                    </span>
                  )}
                  <Link href={`/sigep/dashboard/cases/${c.id}`} className="text-xs text-blue-500 hover:underline flex-shrink-0">
                    Ouvrir →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* SUPER_ADMIN: system health row */}
      {role === 'SUPER_ADMIN' && <SuperAdminHealthRow />}

      {/* JUDGE: quick links */}
      {role === 'JUDGE' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/sigep/dashboard/cases/new', label: 'Nouveau dossier', color: 'bg-emerald-600 text-white' },
            { href: '/sigep/dashboard/revocations', label: 'Révocations', color: 'bg-red-50 text-red-700 border border-red-200' },
            { href: '/sigep/dashboard/rapports', label: 'Rapports', color: 'bg-blue-50 text-blue-700 border border-blue-200' },
            { href: '/sigep/dashboard/agenda', label: 'Agenda', color: 'bg-purple-50 text-purple-700 border border-purple-200' },
          ].map((l) => (
            <Link key={l.href} href={l.href} className={`rounded-xl px-4 py-3 text-sm font-semibold text-center transition-all hover:opacity-80 ${l.color}`}>
              {l.label}
            </Link>
          ))}
        </div>
      )}

      {/* OPERATIONAL: action quick links */}
      {role === 'OPERATIONAL' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: '/sigep/dashboard/map', label: 'Surveillance carte', color: 'bg-slate-800 text-white' },
            { href: '/sigep/dashboard/monitoring', label: 'Temps réel', color: 'bg-emerald-600 text-white' },
            { href: '/sigep/dashboard/infractions', label: 'Infractions', color: 'bg-red-50 text-red-700 border border-red-200' },
          ].map((l) => (
            <Link key={l.href} href={l.href} className={`rounded-xl px-4 py-3 text-sm font-semibold text-center transition-all hover:opacity-80 ${l.color}`}>
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

async function SuperAdminHealthRow() {
  const [maintenance, revocations] = await Promise.all([
    fetchMaintenanceTickets(),
    fetchRevocations('SUPER_ADMIN', ''),
  ]);

  const openTickets  = maintenance.filter((m) => m.status !== 'DONE' && m.status !== 'CANCELLED');
  const highPriority = openTickets.filter((m) => m.priority === 3);
  const pendingRevs  = revocations.filter((r) => r.status === 'PENDING' || r.status === 'UNDER_REVIEW');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Link href="/sigep/dashboard/maintenance" className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-orange-200 transition-colors group">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Maintenance</span>
        </div>
        <p className="text-2xl font-bold text-gray-900">{openTickets.length}</p>
        <p className="text-xs text-gray-400 mt-0.5">ticket{openTickets.length !== 1 ? 's' : ''} ouverts{highPriority.length > 0 && ` · ${highPriority.length} urgents`}</p>
      </Link>
      <Link href="/sigep/dashboard/revocations" className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-red-200 transition-colors group">
        <div className="flex items-center gap-2 mb-2">
          <AlertOctagon className="w-4 h-4 text-red-500" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Révocations</span>
        </div>
        <p className="text-2xl font-bold text-gray-900">{pendingRevs.length}</p>
        <p className="text-xs text-gray-400 mt-0.5">en attente de décision</p>
      </Link>
      <Link href="/sigep/dashboard/parametres" className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-blue-200 transition-colors group">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Système</span>
        </div>
        <p className="text-2xl font-bold text-emerald-600">OK</p>
        <p className="text-xs text-gray-400 mt-0.5">Tous les services actifs</p>
      </Link>
    </div>
  );
}
