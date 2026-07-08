import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  FileText, Download, BarChart2, AlertTriangle,
  FolderOpen, TrendingUp, Clock, CheckCircle,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewReports , allow, canViewPII } from '@/lib/auth/permissions';
import { fetchAlerts, fetchOverviewStats, fetchCases } from '@/lib/mock/helpers';
import DailyReportPicker from '@/components/track/DailyReportPicker';

export const metadata = { title: 'Rapports — SIGEP' };
export const revalidate = 0;

const REPORT_TYPES = [
  {
    slug: 'conformite-mensuelle',
    icon: CheckCircle,
    color: 'emerald',
    title: 'Rapport de conformité mensuel',
    desc: 'Synthèse du respect des conditions judiciaires pour tous les dossiers actifs de la période : taux de présence, infractions, alertes.',
    roles: 'Juge · Super Admin',
  },
  {
    slug: 'alertes-periode',
    icon: AlertTriangle,
    color: 'red',
    title: 'Rapport d\'alertes et violations',
    desc: 'Liste chronologique de toutes les alertes déclenchées : sorties de périmètre, tentatives de sabotage, pertes de signal.',
    roles: 'Juge · Super Admin',
  },
  {
    slug: 'dossier-individuel',
    icon: FolderOpen,
    color: 'blue',
    title: 'Rapport de dossier individuel',
    desc: 'Historique complet d\'un bénéficiaire : positions, alertes, TIG effectués, observations de terrain.',
    roles: 'Juge · Super Admin',
  },
  {
    slug: 'statistiques-nationales',
    icon: TrendingUp,
    color: 'purple',
    title: 'Rapport statistique national',
    desc: 'Tableau de bord agrégé pour le Ministère : nombre de mesures prononcées, taux de récidive, économies générées vs détention.',
    roles: 'Super Admin',
  },
];

const COLOR = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: 'bg-emerald-100 text-emerald-700', btn: 'bg-emerald-600 hover:bg-emerald-500 text-white', badge: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  red:     { bg: 'bg-red-50',     border: 'border-red-100',     icon: 'bg-red-100 text-red-700',         btn: 'bg-red-600 hover:bg-red-500 text-white',         badge: 'bg-red-50 text-red-700 border-red-100' },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-100',    icon: 'bg-blue-100 text-blue-700',       btn: 'bg-blue-600 hover:bg-blue-500 text-white',       badge: 'bg-blue-50 text-blue-700 border-blue-100' },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-100',  icon: 'bg-purple-100 text-purple-700',   btn: 'bg-purple-600 hover:bg-purple-500 text-white',   badge: 'bg-purple-50 text-purple-700 border-purple-100' },
};

// Real export trail (report_exports) — the previous list here was hardcoded
// fiction, indefensible on an institutional page.
interface ExportRow { id: string; report_type: string; title: string; generated_by_name: string | null; generated_at: string }
async function fetchRecentExports(): Promise<{ rows: ExportRow[]; total: number }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return { rows: [], total: 0 };
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const sb = createAdminClient();
  if (!sb) return { rows: [], total: 0 };
  const [{ data }, { count }] = await Promise.all([
    sb.from('report_exports').select('id, report_type, title, generated_by_name, generated_at')
      .order('generated_at', { ascending: false }).limit(8),
    sb.from('report_exports').select('id', { count: 'exact', head: true }),
  ]);
  return { rows: (data ?? []) as ExportRow[], total: count ?? 0 };
}

export default async function RapportsPage() {
  const session = await getSession();
  if (!session || !allow(session, canViewReports(session.role), 'reports')) redirect('/sigep/dashboard');

  const [alerts, stats, cases, exports] = await Promise.all([
    fetchAlerts(session.role),
    fetchOverviewStats(session.role),
    fetchCases(session.role, session.id).catch(() => []),
    fetchRecentExports().catch(() => ({ rows: [], total: 0 })),
  ]);

  const openAlerts = alerts.filter((a) => !a.is_resolved).length;

  const showPII = canViewPII(session.role);
  const itineraryCases = cases
    .map((c) => ({ id: c.id, case_number: c.case_number, name: showPII ? c.individual?.full_name ?? null : null }))
    .sort((a, b) => a.case_number.localeCompare(b.case_number))
    .map((c) => ({ id: c.id, label: c.name ? `${c.case_number} — ${c.name}` : c.case_number }));

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Africa/Ouagadougou', day: '2-digit', month: 'long', year: 'numeric' });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Rapports judiciaires</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Générez et exportez les rapports officiels pour les audiences, le parquet et le Ministère.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Dossiers actifs',    value: stats.active_cases,    color: 'text-emerald-600' },
          { label: 'Alertes en cours',   value: openAlerts,            color: 'text-red-600' },
          { label: 'Individus suivis',   value: stats.monitored_individuals, color: 'text-blue-600' },
          { label: 'Rapports générés',   value: exports.total,         color: 'text-purple-600' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Report type cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {REPORT_TYPES.map((r) => {
          const c = COLOR[r.color as keyof typeof COLOR];
          const Icon = r.icon;
          return (
            <div key={r.slug} className={`bg-white rounded-2xl border ${c.border} p-5 flex flex-col gap-4`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.icon}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight">{r.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.desc}</p>
                  <span className={`inline-flex items-center mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>
                    {r.roles}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 pt-1 border-t border-gray-50">
                <Link
                  href={`/sigep/dashboard/rapports/${r.slug}`}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${c.btn}`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Prévisualiser
                </Link>
                <Link
                  href={`/sigep/dashboard/rapports/${r.slug}?print=1`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Daily itinerary / history — pick a case + day → replay or printable PDF */}
      <DailyReportPicker cases={itineraryCases} />

      {/* Recent exports */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold text-gray-700 text-sm">Exports récents</h3>
        </div>
        {exports.rows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Aucun export enregistré pour l&apos;instant — chaque génération de rapport est tracée ici.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {exports.rows.map((r) => {
              const type = REPORT_TYPES.find((t) => t.slug === r.report_type);
              const Icon = type?.icon ?? BarChart2;
              const c = COLOR[(type?.color ?? 'blue') as keyof typeof COLOR];
              return (
                <li key={r.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50/50 transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${c.icon}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                    <p className="text-[10px] text-gray-400">
                      {formatDate(r.generated_at)}
                      {r.generated_by_name ? ` · par ${r.generated_by_name}` : ''}
                    </p>
                  </div>
                  <Link
                    href={`/sigep/dashboard/rapports/${r.report_type}`}
                    className="flex-shrink-0 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <Download className="w-3 h-3" />
                    Régénérer
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
