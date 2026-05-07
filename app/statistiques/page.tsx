import Link from 'next/link';
import {
  Shield, Activity, TrendingUp, Users, MapPin,
  CheckCircle, AlertTriangle, Clock, ArrowRight,
} from 'lucide-react';
import SiteHeader from '@/components/public/SiteHeader';
import SiteFooter from '@/components/public/SiteFooter';

export const metadata = {
  title: 'Statistiques — Système Horon · Burkina Faso',
  description: 'Données agrégées et anonymisées du programme de surveillance électronique au Burkina Faso.',
};

const STATS = [
  { value: '47',   label: 'Bracelets déployés',     icon: Shield,       color: 'emerald', sub: 'dispositifs actifs sur le territoire' },
  { value: '94 %', label: 'Taux de conformité',     icon: CheckCircle,  color: 'blue',    sub: 'des obligations judiciaires respectées' },
  { value: '213',  label: 'TIG réalisés',            icon: Users,        color: 'amber',   sub: 'journées de travail d\'intérêt général' },
  { value: '3',    label: 'Juridictions couvertes',  icon: MapPin,       color: 'purple',  sub: 'Ouagadougou, Bobo-Dioulasso, Koudougou' },
  { value: '6 →1', label: 'Taux de récidive',        icon: TrendingUp,   color: 'red',     sub: 'vs taux moyen carcéral de 6 sur 10' },
  { value: '24/7', label: 'Monitoring continu',      icon: Activity,     color: 'slate',   sub: 'centre de contrôle opérationnel' },
];

const COLOR = {
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', num: 'text-emerald-700', border: 'border-emerald-100' },
  blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    num: 'text-blue-700',    border: 'border-blue-100' },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   num: 'text-amber-700',   border: 'border-amber-100' },
  purple:  { bg: 'bg-purple-50',  icon: 'text-purple-600',  num: 'text-purple-700',  border: 'border-purple-100' },
  red:     { bg: 'bg-red-50',     icon: 'text-red-600',     num: 'text-red-700',     border: 'border-red-100' },
  slate:   { bg: 'bg-slate-50',   icon: 'text-slate-600',   num: 'text-slate-700',   border: 'border-slate-200' },
};

const MONTHLY = [
  { month: 'Jan', cases: 8,  conformite: 92 },
  { month: 'Fév', cases: 12, conformite: 91 },
  { month: 'Mar', cases: 18, conformite: 93 },
  { month: 'Avr', cases: 24, conformite: 95 },
  { month: 'Mai', cases: 31, conformite: 94 },
  { month: 'Jun', cases: 38, conformite: 96 },
  { month: 'Jul', cases: 43, conformite: 94 },
  { month: 'Aoû', cases: 47, conformite: 94 },
];

const BY_MEASURE = [
  { label: 'Contrôle judiciaire',     count: 22, pct: 47, color: 'bg-emerald-500' },
  { label: 'Assignation à domicile',  count: 15, pct: 32, color: 'bg-blue-500' },
  { label: 'TIG électronique',        count: 7,  pct: 15, color: 'bg-amber-500' },
  { label: 'Libération conditionnelle', count: 3, pct: 6, color: 'bg-purple-500' },
];

const BY_JURISDICTION = [
  { name: 'TGI Ouagadougou',       count: 32, pct: 68, color: 'bg-emerald-500' },
  { name: 'TGI Bobo-Dioulasso',    count: 10, pct: 21, color: 'bg-blue-500' },
  { name: 'TGI Koudougou',         count: 5,  pct: 11, color: 'bg-amber-500' },
];

const ALERTS_BY_TYPE = [
  { label: 'Sortie de périmètre',    count: 38, pct: 68, color: 'bg-red-400' },
  { label: 'Batterie critique',      count: 11, pct: 20, color: 'bg-amber-400' },
  { label: 'Perte de signal',        count: 4,  pct: 7,  color: 'bg-slate-400' },
  { label: 'Tentative de sabotage',  count: 3,  pct: 5,  color: 'bg-red-700' },
];

function Bar({ label, count, pct, color }: { label: string; count: number; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-sm text-gray-600 w-44 flex-shrink-0 truncate">{label}</p>
      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-bold text-gray-700 w-8 text-right">{count}</span>
      <span className="text-xs text-gray-400 w-8">{pct}%</span>
    </div>
  );
}

export default function StatistiquesPage() {
  const maxCases = Math.max(...MONTHLY.map((m) => m.cases));
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-gray-50">

        {/* Hero */}
        <section className="bg-white border-b border-gray-100 py-12">
          <div className="max-w-5xl mx-auto px-6">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-4 py-1.5 text-xs font-semibold text-emerald-700 mb-4">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Données actualisées — Mai 2024
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              Tableau de bord public
            </h1>
            <p className="text-gray-500 max-w-xl leading-relaxed">
              Données agrégées et anonymisées du programme de surveillance électronique. Aucune information nominative n&apos;est divulguée.
            </p>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {STATS.map((s) => {
              const c = COLOR[s.color as keyof typeof COLOR];
              const Icon = s.icon;
              return (
                <div key={s.label} className={`${c.bg} border ${c.border} rounded-2xl p-5`}>
                  <Icon className={`w-6 h-6 ${c.icon} mb-3`} />
                  <p className={`text-3xl font-bold ${c.num}`}>{s.value}</p>
                  <p className="text-sm font-semibold text-gray-700 mt-1">{s.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Trend chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">Évolution du déploiement</h2>
            <p className="text-xs text-gray-400 mb-6">Nombre cumulatif de bracelets déployés par mois en 2024</p>
            <div className="flex items-end gap-3 h-36">
              {MONTHLY.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-emerald-500 rounded-t-md transition-all"
                    style={{ height: `${(m.cases / maxCases) * 100}%` }}
                    title={`${m.cases} dossiers`}
                  />
                  <span className="text-[10px] text-gray-400">{m.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2-column charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Répartition par type de mesure</h2>
              {BY_MEASURE.map((b) => <Bar key={b.label} {...b} />)}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Répartition par juridiction</h2>
              {BY_JURISDICTION.map((b) => <Bar key={b.name} label={b.name} count={b.count} pct={b.pct} color={b.color} />)}
            </div>
          </div>

          {/* Alert stats */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h2 className="text-sm font-bold text-gray-900">Alertes — types et fréquence</h2>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              {38 + 11 + 4 + 3} alertes traitées depuis janvier 2024. Taux de résolution : 96 %.
            </p>
            <div className="space-y-3">
              {ALERTS_BY_TYPE.map((a) => <Bar key={a.label} {...a} />)}
            </div>
          </div>

          {/* Economy */}
          <div className="bg-emerald-700 rounded-2xl p-8 text-white">
            <div className="flex items-start gap-4">
              <Clock className="w-8 h-8 text-emerald-300 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-xl font-bold mb-2">Impact économique estimé</h2>
                <p className="text-emerald-100 leading-relaxed mb-4 text-sm">
                  Chaque journée de détention provisoire évitée représente une économie directe pour l&apos;État. Avec 47 bracelets actifs et un coût journalier de détention de 3 500 FCFA / individu, le programme génère des économies substantielles tout en préservant les droits fondamentaux.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { val: '1 420',     lbl: 'Jours de détention évités' },
                    { val: '4,97 M',    lbl: 'FCFA économisés (à ce jour)' },
                    { val: '3 500 FCFA', lbl: 'Coût/jour/individu en détention' },
                  ].map((e) => (
                    <div key={e.lbl} className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                      <p className="text-2xl font-bold text-white">{e.val}</p>
                      <p className="text-xs text-emerald-200 mt-0.5">{e.lbl}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-4">Vous représentez une institution partenaire ?</p>
            <Link
              href="/#contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors"
            >
              Accéder aux données détaillées <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
