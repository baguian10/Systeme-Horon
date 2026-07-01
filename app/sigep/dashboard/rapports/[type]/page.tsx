import { redirect, notFound } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { canViewReports } from '@/lib/auth/permissions';
import { fetchCases, fetchAlerts, fetchOverviewStats, fetchCaseStatusCounts, fetchAlertTypeCounts } from '@/lib/mock/helpers';
import PrintButton from '@/components/rapports/PrintButton';

const REPORT_TITLES: Record<string, string> = {
  'conformite-mensuelle':    'Rapport de conformité mensuel',
  'alertes-periode':         "Rapport d'alertes et violations",
  'dossier-individuel':      'Rapport de dossier individuel',
  'statistiques-nationales': 'Rapport statistique national',
};

const CASE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Actifs', VIOLATION: 'En violation', PENDING: 'En attente',
  SUSPENDED: 'Suspendus', TERMINATED: 'Clôturés',
};

const ALERT_LABELS: Record<string, string> = {
  GEOFENCE_EXIT:    'Sortie de périmètre',
  TAMPER_DETECTED:  'Tentative de sabotage',
  BATTERY_LOW:      'Batterie critique',
  SIGNAL_LOST:      'Perte de signal',
  HEALTH_CRITICAL:  'Urgence médicale',
  PANIC_BUTTON:     'Bouton panique',
};

export default async function RapportViewPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const session = await getSession();
  if (!session || !canViewReports(session.role)) redirect('/sigep/dashboard');

  const title = REPORT_TITLES[type];
  if (!title) notFound();

  const isNational = type === 'statistiques-nationales';
  const isAlertsReport = type === 'alertes-periode';

  const [cases, alerts, stats] = await Promise.all([
    fetchCases(session.role, session.id),
    fetchAlerts(session.role),
    fetchOverviewStats(session.role),
  ]);

  const activeCases   = cases.filter((c) => c.status === 'ACTIVE' || c.status === 'VIOLATION');
  const openAlerts    = alerts.filter((a) => !a.is_resolved);
  const resolvedAlerts = alerts.filter((a) => a.is_resolved);

  const nowDate = new Date();
  const now = nowDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const monthYear = nowDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const year = nowDate.getFullYear();
  const subtitle = isNational ? `Exercice ${year}`
    : isAlertsReport ? `Alertes — ${monthYear}`
    : type === 'dossier-individuel' ? 'Dossiers actifs'
    : `Période : ${monthYear}`;

  // Real compliance — supervised cases without an active violation. Was a
  // hardcoded "94 %" in an official judicial report, which is indefensible.
  const supervised = stats.active_cases + stats.violation_cases;
  const complianceRate = supervised > 0 ? Math.round((stats.active_cases / supervised) * 100) : null;

  // National report = PII-free aggregate distributions (no individual names).
  const [statusCounts, alertCounts] = isNational
    ? await Promise.all([fetchCaseStatusCounts(), fetchAlertTypeCounts()])
    : [null, null];
  const statusTotal = statusCounts ? Object.values(statusCounts).reduce((a, b) => a + b, 0) || 1 : 1;

  return (
    <div className="space-y-6">
      {/* Toolbar — hidden when printing */}
      <div className="flex items-center gap-3 print:hidden">
        <Link
          href="/sigep/dashboard/rapports"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux rapports
        </Link>
        <div className="flex-1" />
        <PrintButton />
      </div>

      {/* ── Printable report ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-8 print:border-0 print:rounded-none print:p-0 print:shadow-none">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">SIGEP · Système Horon</p>
              <p className="text-xs text-gray-400">Ministère de la Justice et des Droits Humains — Burkina Faso</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Généré le {now}</p>
            <p className="text-xs text-gray-400">Ref : {type.toUpperCase().replace(/-/g, '_')}_{year}</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-1 mb-8">{subtitle}</p>

        {/* ── Section 1 : Synthèse ──────────────────────────────── */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">
            1 — Synthèse de la période
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Dossiers actifs',          value: stats.active_cases,          sub: 'sous surveillance' },
              { label: 'Taux de conformité',        value: complianceRate !== null ? `${complianceRate} %` : '—', sub: 'des obligations' },
              { label: 'Alertes traitées',          value: resolvedAlerts.length,       sub: 'sur ' + alerts.length },
              { label: 'Violations enregistrées',   value: stats.violation_cases,       sub: 'dossiers en infraction' },
            ].map((s) => (
              <div key={s.label} className="border border-gray-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs font-semibold text-gray-600 mt-0.5">{s.label}</p>
                <p className="text-[10px] text-gray-400">{s.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {isNational ? (
          <>
            {/* ── Section 2 : Répartition des mesures (agrégat, sans nominatif) ── */}
            <section className="mb-8">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">
                2 — Répartition des mesures
              </h2>
              <div className="space-y-2">
                {(['ACTIVE', 'VIOLATION', 'SUSPENDED', 'TERMINATED', 'PENDING'] as const).map((s) => {
                  const v = statusCounts?.[s] ?? 0;
                  return (
                    <div key={s} className="flex items-center gap-3 text-xs">
                      <span className="w-40 text-gray-600">{CASE_STATUS_LABELS[s]}</span>
                      <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                        <div className={`h-full rounded ${s === 'VIOLATION' ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ width: `${(v / statusTotal) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right font-bold text-gray-800">{v}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ── Section 3 : Alertes par type (agrégat) ── */}
            <section className="mb-8">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">
                3 — Alertes par type
              </h2>
              <div className="space-y-2">
                {(['GEOFENCE_EXIT', 'CURFEW_VIOLATION', 'TAMPER_DETECTED', 'HEALTH_CRITICAL', 'BATTERY_LOW', 'SIGNAL_LOST', 'PANIC_BUTTON'] as const).map((t) => {
                  const v = alertCounts?.byType[t] ?? 0;
                  const max = alertCounts ? Math.max(1, ...Object.values(alertCounts.byType)) : 1;
                  return (
                    <div key={t} className="flex items-center gap-3 text-xs">
                      <span className="w-40 text-gray-600">{ALERT_LABELS[t] ?? t}</span>
                      <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                        <div className="h-full bg-orange-400 rounded" style={{ width: `${(v / max) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right font-bold text-gray-800">{v}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">Total : {alertCounts?.total ?? 0} alertes · {alertCounts?.resolved ?? 0} traitées</p>
            </section>
          </>
        ) : (
          <>
            {/* ── Section 2 : Dossiers (masquée pour le rapport d'alertes) ── */}
            {!isAlertsReport && (
              <section className="mb-8">
                <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">
                  2 — Dossiers sous surveillance ({activeCases.length})
                </h2>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      {['N° Dossier', 'Individu', 'Statut', 'Début', 'Alertes', 'Juge'].map((h) => (
                        <th key={h} className="px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide border border-gray-100">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeCases.map((c) => (
                      <tr key={c.id} className="border-b border-gray-50 even:bg-gray-50/40">
                        <td className="px-3 py-2 font-mono font-bold text-gray-800 border border-gray-100">{c.case_number}</td>
                        <td className="px-3 py-2 text-gray-700 border border-gray-100">{c.individual?.full_name ?? '—'}</td>
                        <td className="px-3 py-2 border border-gray-100">
                          <span className={`font-bold ${c.status === 'VIOLATION' ? 'text-red-600' : 'text-emerald-600'}`}>
                            {c.status === 'VIOLATION' ? 'VIOLATION' : 'Actif'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 border border-gray-100">
                          {c.start_date ? new Date(c.start_date).toLocaleDateString('fr-FR') : '—'}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold border border-gray-100">
                          <span className={c.alert_count ? 'text-red-600' : 'text-gray-400'}>
                            {c.alert_count ?? 0}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 border border-gray-100">{c.judge?.full_name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* ── Section : Alertes (toutes pour le rapport d'alertes, sinon en cours) ── */}
            {(isAlertsReport ? alerts : openAlerts).length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider border-b border-gray-100 pb-2 mb-4">
                  {isAlertsReport ? `2 — Alertes sur la période (${alerts.length})` : `3 — Alertes en cours (${openAlerts.length})`}
                </h2>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      {['Type', 'Sév.', 'Statut', 'Description', 'Dossier', 'Date déclenchement'].map((h) => (
                        <th key={h} className="px-3 py-2.5 font-semibold text-gray-500 uppercase tracking-wide text-left border border-gray-100">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(isAlertsReport ? alerts : openAlerts).map((a) => (
                      <tr key={a.id} className="border-b border-gray-50 even:bg-gray-50/40">
                        <td className="px-3 py-2 font-semibold text-red-600 border border-gray-100">
                          {ALERT_LABELS[a.alert_type] ?? a.alert_type}
                        </td>
                        <td className="px-3 py-2 text-center font-bold border border-gray-100">{a.severity}/5</td>
                        <td className="px-3 py-2 border border-gray-100">
                          <span className={a.is_resolved ? 'text-emerald-600' : 'text-red-600 font-semibold'}>
                            {a.is_resolved ? 'Traitée' : 'Active'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 border border-gray-100 max-w-xs">{a.description ?? '—'}</td>
                        <td className="px-3 py-2 font-mono border border-gray-100">
                          {(a.case as { case_number?: string } | undefined)?.case_number ?? a.case_id.slice(0, 8)}
                        </td>
                        <td className="px-3 py-2 text-gray-500 border border-gray-100">
                          {new Date(a.triggered_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 pt-6 mt-8 flex items-center justify-between text-[10px] text-gray-400">
          <span>SIGEP — Système de Surveillance Électronique du Burkina Faso</span>
          <span>Document confidentiel — Usage officiel exclusivement</span>
          <span>Page 1/1</span>
        </div>
      </div>
    </div>
  );
}
