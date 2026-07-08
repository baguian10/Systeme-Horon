import { redirect } from 'next/navigation';
import { AlertTriangle, Repeat } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewViolations, allow } from '@/lib/auth/permissions';
import { fetchViolations, fetchCases } from '@/lib/mock/helpers';
import InfractionsList, { type InfractionRow } from '@/components/infractions/InfractionsList';

export const metadata = { title: 'Infractions — SIGEP' };
export const revalidate = 0;

export default async function InfractionsPage() {
  const session = await getSession();
  if (!session || !allow(session, canViewViolations(session.role), 'reports')) redirect('/sigep/dashboard');

  const [violations, cases] = await Promise.all([
    fetchViolations(session.role),
    fetchCases(session.role, session.id),
  ]);

  const caseMap = new Map(cases.map((c) => [c.id, c]));

  // Recidivism: chronological rank of each infraction within its case.
  const byCase = new Map<string, typeof violations>();
  for (const v of violations) {
    const arr = byCase.get(v.case_id) ?? [];
    arr.push(v);
    byCase.set(v.case_id, arr);
  }
  const nthById = new Map<string, { nth: number; total: number }>();
  for (const [, arr] of byCase) {
    const chrono = arr.slice().sort((a, b) => Date.parse(a.triggered_at) - Date.parse(b.triggered_at));
    chrono.forEach((v, i) => nthById.set(v.id, { nth: i + 1, total: chrono.length }));
  }

  const rows: InfractionRow[] = violations.map((v) => ({
    id: v.id,
    alert_type: v.alert_type,
    severity: v.severity,
    description: v.description,
    triggered_at: v.triggered_at,
    is_resolved: v.is_resolved,
    resolved_at: v.resolved_at,
    case_id: v.case_id,
    case_number: caseMap.get(v.case_id)?.case_number ?? null,
    position_lat: v.position_lat,
    position_lon: v.position_lon,
    nth: nthById.get(v.id)?.nth ?? 1,
    caseTotal: nthById.get(v.id)?.total ?? 1,
  }));

  const critiques = violations.filter((v) => v.severity >= 4);
  const moderees  = violations.filter((v) => v.severity === 3);
  const faibles   = violations.filter((v) => v.severity <= 2);
  const active    = violations.filter((v) => !v.is_resolved).length;
  // Repeat offenders: cases with 3+ recorded infractions.
  const recidivists = [...byCase.entries()].filter(([, arr]) => arr.length >= 3).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Historique des infractions</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Toutes les violations enregistrées — sorties de périmètre, domicile (BLE), couvre-feu et tentatives de sabotage
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-white border border-gray-100 rounded-lg px-3 py-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          {active} infraction{active !== 1 ? 's' : ''} active{active !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Severity + recidivism tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Critiques (≥4)', count: critiques.length, color: 'text-red-700',    bg: 'bg-red-50 border-red-100' },
          { label: 'Modérées (3)',   count: moderees.length,  color: 'text-orange-600', bg: 'bg-orange-50 border-orange-100' },
          { label: 'Faibles (≤2)',   count: faibles.length,   color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-100' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 ${s.bg}`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
        <div className="rounded-2xl border p-4 bg-violet-50 border-violet-100" data-tip="Dossiers cumulant 3 infractions ou plus — candidats à une procédure de révocation">
          <p className="text-3xl font-bold text-violet-700 flex items-center gap-1.5">
            <Repeat className="w-5 h-5" /> {recidivists}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Dossiers récidivistes (≥3)</p>
        </div>
      </div>

      {/* Filterable, exportable timeline with recidivism markers */}
      <InfractionsList rows={rows} />

      {/* Info box */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Conservation des données</p>
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
            Conformément au cadre légal burkinabé, les enregistrements d&apos;infractions sont conservés 5 ans après la clôture du dossier judiciaire correspondant.
            Toute consultation est tracée dans le journal d&apos;audit. L&apos;export CSV vaut extraction pour production judiciaire.
          </p>
        </div>
      </div>
    </div>
  );
}
