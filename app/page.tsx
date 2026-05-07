import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, Shield, MapPin, Activity, Users, Scale,
  CheckCircle, Zap, Eye, Shovel, TreePine, Building2,
} from 'lucide-react';
import SiteHeader from '@/components/public/SiteHeader';
import SiteFooter from '@/components/public/SiteFooter';

export const metadata = {
  title: "Système Horon — Justice Active & TIG · Burkina Faso",
  description: "Programme national de surveillance électronique pour Travaux d'Intérêt Général : une alternative moderne et humaine à la détention provisoire.",
};

const STATS = [
  { value: '73%',  label: "Réduction de la récidive",   sub: 'vs détention classique' },
  { value: '24/7', label: 'Surveillance continue',       sub: 'sans interruption' },
  { value: '3×',   label: "Réinsertion professionnelle", sub: 'meilleure qu\'en prison' },
  { value: '100%', label: 'Conformité juridique',        sub: 'Code de procédure pénale' },
];

const TIG_SECTORS = [
  { icon: <Shovel className="w-5 h-5" />,    label: 'Agriculture & environnement' },
  { icon: <Building2 className="w-5 h-5" />, label: 'Travaux publics urbains' },
  { icon: <TreePine className="w-5 h-5" />,  label: 'Entretien des espaces verts' },
  { icon: <Users className="w-5 h-5" />,     label: 'Services sociaux communautaires' },
];

const PILLARS = [
  {
    icon: <Scale className="w-5 h-5" />,
    title: "Présomption d'innocence",
    desc: "Garantie constitutionnelle préservée tout au long de la procédure.",
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: 'Liens familiaux maintenus',
    desc: "Le prévenu conserve ses responsabilités familiales et professionnelles.",
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Sécurité publique garantie',
    desc: 'Surveillance rigoureuse assurant la protection de la communauté.',
  },
  {
    icon: <Activity className="w-5 h-5" />,
    title: 'Suivi judiciaire continu',
    desc: 'Conformité aux ordonnances vérifiée en temps réel.',
  },
];

const FEATURES = [
  {
    icon: <MapPin className="w-5 h-5" />,
    title: 'Géolocalisation sécurisée',
    desc: 'Positionnement en temps réel avec précision certifiée. Mise à jour automatique toutes les 30 secondes en zone active.',
    accent: 'bg-emerald-50 text-emerald-700',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Alertes instantanées',
    desc: "Notification immédiate des agents et du juge en cas d'incident détecté. Délai inférieur à 2 secondes.",
    accent: 'bg-red-50 text-red-700',
  },
  {
    icon: <Eye className="w-5 h-5" />,
    title: 'Périmètres configurables',
    desc: "Le juge configure des zones d'inclusion et d'exclusion personnalisées selon l'ordonnance.",
    accent: 'bg-blue-50 text-blue-700',
  },
  {
    icon: <CheckCircle className="w-5 h-5" />,
    title: 'Traçabilité complète',
    desc: "Journal d'audit immuable de toutes les actions effectuées sur le système.",
    accent: 'bg-amber-50 text-amber-700',
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>

        {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
        <section className="relative min-h-screen flex flex-col justify-center bg-slate-900 overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/reinsertion-sociale.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-center opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-900/85 to-emerald-950/90" />
          </div>

          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-600 via-amber-500 to-red-600" />

          <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-20 w-full">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2.5 bg-emerald-600/15 border border-emerald-500/25 rounded-full px-4 py-2 mb-10">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-medium text-emerald-300">Initiative Présidentielle · Burkina Faso</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.08] tracking-tight mb-6">
                Une Justice
                <span className="block text-emerald-400">Active.</span>
                <span className="block">Une Réinsertion Garantie.</span>
              </h1>

              <p className="text-xl text-slate-300 max-w-2xl leading-relaxed mb-10">
                Le Système Horon permet aux personnes condamnées à des Travaux d&apos;Intérêt Général de servir leur peine au cœur de la communauté — sous surveillance électronique stricte, dans le respect de leur dignité.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/initiative"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/40"
                >
                  Découvrir l&apos;initiative <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/fonctionnement"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-slate-600 text-slate-200 font-semibold text-sm hover:bg-slate-800 transition-colors"
                >
                  Voir le fonctionnement
                </Link>
              </div>
            </div>
          </div>

          {/* Stats band */}
          <div className="relative z-10 border-t border-slate-700/60 bg-slate-900/70 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-3xl font-bold text-emerald-400">{s.value}</p>
                  <p className="text-xs font-semibold text-white mt-1">{s.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ TIG SECTION ═══════════════════════════════════════════════════════ */}
        <section className="py-28 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5 mb-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Travaux d&apos;Intérêt Général</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight mb-6">
                  Servir sa peine en
                  <span className="text-emerald-600"> servant la communauté</span>
                </h2>
                <p className="text-slate-600 text-lg leading-relaxed mb-5">
                  Le TIG est une mesure judiciaire qui permet à des personnes condamnées pour des infractions non graves de réaliser des travaux au bénéfice de la collectivité, plutôt que d&apos;être incarcérées.
                </p>
                <p className="text-slate-500 leading-relaxed mb-8">
                  Le Système Horon assure la surveillance électronique de chaque bénéficiaire pendant ses heures de TIG et en dehors, garantissant le respect scrupuleux des termes de l&apos;ordonnance judiciaire.
                </p>

                <div className="grid grid-cols-2 gap-3 mb-8">
                  {TIG_SECTORS.map((s) => (
                    <div key={s.label} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                        {s.icon}
                      </div>
                      <span className="text-xs font-semibold text-slate-700 leading-tight">{s.label}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/initiative"
                  className="inline-flex items-center gap-2 font-semibold text-emerald-600 hover:text-emerald-700 group transition-colors"
                >
                  En savoir plus sur le programme
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              <div className="relative">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl shadow-slate-200">
                  <Image
                    src="/reinsertion-sociale.jpg"
                    alt="Travaux d'intérêt général — travail communautaire"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl shadow-xl border border-slate-100 px-5 py-4">
                  <p className="text-2xl font-bold text-emerald-600">73%</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Réduction de la récidive</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ MISSION ═══════════════════════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-10 h-px bg-emerald-600" />
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Notre mission</span>
                <div className="w-10 h-px bg-emerald-600" />
              </div>
              <h2 className="text-4xl font-bold text-slate-900 mb-4">
                Moderniser la justice, préserver la dignité
              </h2>
              <p className="text-slate-500 max-w-2xl mx-auto text-lg">
                Une société juste ne punit pas par défaut. Elle protège, elle surveille, et elle offre la possibilité de se réhabiliter par le travail et l&apos;engagement communautaire.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {PILLARS.map((p) => (
                <div key={p.title} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                    {p.icon}
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2 leading-tight">{p.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ FEATURES GRID ═════════════════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-10 h-px bg-emerald-600" />
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Capacités du système</span>
                <div className="w-10 h-px bg-emerald-600" />
              </div>
              <h2 className="text-4xl font-bold text-slate-900">
                Une technologie au service de la justice
              </h2>
              <p className="text-slate-500 mt-4 max-w-xl mx-auto">
                Des outils de surveillance certifiés, conçus pour garantir la conformité aux décisions judiciaires avec la plus haute fiabilité.
              </p>
            </div>

            {/* Main bento: large card left + 3 small right */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
              <div className="lg:col-span-2 bg-slate-900 rounded-2xl p-10 flex flex-col justify-between min-h-72 relative overflow-hidden">
                <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-emerald-600/10" />
                <div className="absolute -right-4 -bottom-4 w-40 h-40 rounded-full bg-emerald-600/10" />
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-600/20 flex items-center justify-center mb-6">
                    <MapPin className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Géolocalisation en temps réel</h3>
                  <p className="text-slate-400 leading-relaxed max-w-lg">
                    Positionnement continu avec précision certifiée. Mise à jour automatique et transmission chiffrée des coordonnées vers les agents habilités, 24h/24.
                  </p>
                </div>
                <div className="mt-8 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm text-slate-400 font-medium">Actif en permanence · Ouagadougou</span>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <div className="flex-1 bg-slate-50 rounded-2xl p-7 border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">Alertes instantanées</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Notification immédiate des agents et du juge responsable dès qu&apos;un incident est détecté.
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-lg">
                    Délai &lt; 2 secondes
                  </div>
                </div>

                <div className="flex-1 bg-slate-50 rounded-2xl p-7 border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                    <Eye className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">Périmètres configurables</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Le juge définit les zones autorisées selon les termes exacts de l&apos;ordonnance.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-slate-50 rounded-2xl p-7 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">Traçabilité complète</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Journal d&apos;audit immuable. Chaque action est enregistrée conformément au droit burkinabè.
                </p>
              </div>
              <div className="bg-emerald-600 rounded-2xl p-7 text-white">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center mb-4">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold mb-2">Chiffrement de bout en bout</h3>
                <p className="text-sm text-emerald-100 leading-relaxed">
                  Toutes les données sont chiffrées selon les standards gouvernementaux. Accès strictement limité au personnel judiciaire habilité.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══ CTA ═══════════════════════════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-slate-900 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #059669 0%, transparent 60%)' }} />
          <div className="relative max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
              Une justice qui réhabilite<br />autant qu&apos;elle protège
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
              Découvrez comment le programme national de surveillance électronique transforme l&apos;approche judiciaire du Burkina Faso, en plaçant la dignité humaine et le travail communautaire au cœur de la procédure.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/initiative"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-colors shadow-lg"
              >
                L&apos;Initiative Présidentielle <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/fonctionnement"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-slate-600 text-slate-200 font-semibold text-sm hover:bg-slate-800 transition-colors"
              >
                Le fonctionnement
              </Link>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
