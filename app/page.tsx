import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, Shield, MapPin, Activity, Users, Scale, Lock,
  CheckCircle, Zap, Eye,
} from 'lucide-react';
import SiteHeader from '@/components/public/SiteHeader';
import SiteFooter from '@/components/public/SiteFooter';

export const metadata = {
  title: 'Système Horon — Justice Humaine & Sécurisée · Burkina Faso',
  description: "Programme national de surveillance électronique — une alternative humaine à la détention provisoire, garantissant sécurité et dignité.",
};

const STATS = [
  { value: '73%', label: 'Réduction de la récidive', sub: 'vs détention classique' },
  { value: '24/7', label: 'Surveillance continue',   sub: 'sans interruption' },
  { value: '<2s',  label: "Délai d'alerte",          sub: "en cas d'incident" },
  { value: '100%', label: 'Conformité juridique',    sub: 'Code de procédure pénale' },
];

const PILLARS = [
  { icon: <Scale className="w-5 h-5" />,    title: "Présomption d'innocence", desc: 'Garantie constitutionnelle préservée tout au long de la procédure judiciaire.' },
  { icon: <Users className="w-5 h-5" />,    title: 'Liens familiaux maintenus', desc: 'Le prévenu conserve ses responsabilités familiales, sociales et professionnelles.' },
  { icon: <Shield className="w-5 h-5" />,   title: 'Sécurité publique garantie', desc: 'Surveillance rigoureuse assurant la protection de la communauté nationale.' },
  { icon: <Activity className="w-5 h-5" />, title: 'Suivi judiciaire continu', desc: 'Conformité aux ordonnances vérifiée en temps réel par les agents habilités.' },
];

const FEATURES = [
  {
    icon: <MapPin className="w-6 h-6" />,
    title: 'Géolocalisation sécurisée',
    desc: 'Positionnement en temps réel avec précision certifiée. Mise à jour automatique toutes les 30 secondes en zone active.',
    size: 'lg',
    color: 'bg-bf-green text-white',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Alertes instantanées',
    desc: "Notification immédiate des agents et du juge responsable en cas d'incident détecté.",
    size: 'sm',
    color: 'bg-bf-red text-white',
  },
  {
    icon: <Eye className="w-6 h-6" />,
    title: 'Périmètres de sécurité',
    desc: "Le juge configure des zones d'inclusion et d'exclusion personnalisées selon l'ordonnance.",
    size: 'sm',
    color: 'bg-gray-900 text-white',
  },
  {
    icon: <Lock className="w-6 h-6" />,
    title: 'Données chiffrées',
    desc: 'Chiffrement de bout en bout. Accès strictement limité aux personnels judiciaires habilités.',
    size: 'sm',
    color: 'bg-bf-gold text-gray-900',
  },
  {
    icon: <CheckCircle className="w-6 h-6" />,
    title: 'Traçabilité complète',
    desc: "Journal d'audit immuable de toutes les actions effectuées sur le système.",
    size: 'sm',
    color: 'bg-white border border-gray-200 text-gray-800',
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>

        {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
        <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
          {/* Background image */}
          <div className="absolute inset-0">
            <Image
              src="https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=2000"
              alt=""
              fill
              priority
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/97 via-green-950/93 to-emerald-900/90" />
          </div>

          {/* Decorative grid lines */}
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '80px 80px' }} />

          {/* Gold bar top */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-bf-green via-bf-gold to-bf-red" />

          <div className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-20 w-full">
            <div className="max-w-3xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2.5 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 py-2 mb-10">
                <div className="w-2 h-2 rounded-full bg-bf-gold animate-pulse" />
                <span className="text-sm font-medium text-white/90">Initiative Présidentielle · Burkina Faso</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.08] tracking-tight mb-8">
                Pour une Justice
                <span className="block text-bf-gold">Humaine</span>
                <span className="block">& Sécurisée</span>
              </h1>

              <p className="text-xl text-white/75 max-w-2xl leading-relaxed mb-10">
                Le Système Horon offre une alternative moderne et digne à la détention provisoire — protégeant la présomption d&apos;innocence tout en garantissant la sécurité de la nation burkinabè.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/initiative"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-bf-gold text-gray-900 font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-yellow-900/30"
                >
                  L&apos;Initiative Présidentielle <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/fonctionnement"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border border-white/25 text-white font-semibold text-sm hover:bg-white/10 transition-all backdrop-blur"
                >
                  Voir le fonctionnement
                </Link>
              </div>
            </div>
          </div>

          {/* Stats band */}
          <div className="relative z-10 border-t border-white/10 bg-black/30 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-3xl font-bold text-bf-gold">{s.value}</p>
                  <p className="text-xs font-semibold text-white mt-1">{s.label}</p>
                  <p className="text-[10px] text-white/50 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ MISSION ═══════════════════════════════════════════════════════════ */}
        <section className="py-28 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-px bg-bf-green" />
                  <span className="text-xs font-bold text-bf-green uppercase tracking-widest">Notre mission</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight mb-6">
                  Moderniser la justice,
                  <span className="text-bf-green"> préserver la dignité</span>
                </h2>
                <p className="text-gray-600 text-lg leading-relaxed mb-5">
                  Face à la surpopulation carcérale et aux défis de réinsertion sociale, le Burkina Faso innove avec un programme de surveillance électronique qui offre une alternative humaine à la détention provisoire.
                </p>
                <p className="text-gray-500 leading-relaxed mb-8">
                  Le Système Horon permet aux prévenus de maintenir leurs liens familiaux et professionnels tout en garantissant leur disponibilité pour la justice — une approche qui réduit la récidive et préserve les ressources pénitentiaires.
                </p>
                <Link
                  href="/initiative"
                  className="inline-flex items-center gap-2 font-semibold text-bf-green hover:gap-3 transition-all group"
                >
                  Découvrir l&apos;initiative présidentielle
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Pillars grid */}
              <div className="grid grid-cols-2 gap-4">
                {PILLARS.map((p) => (
                  <div key={p.title} className="bg-institutional rounded-2xl p-5 border border-gray-100 hover:border-bf-green/30 hover:shadow-sm transition-all">
                    <div className="w-10 h-10 rounded-xl bg-bf-green/10 text-bf-green flex items-center justify-center mb-3">
                      {p.icon}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm mb-1.5 leading-tight">{p.title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══ BENTO FEATURES ════════════════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-institutional">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-10 h-px bg-bf-green" />
                <span className="text-xs font-bold text-bf-green uppercase tracking-widest">Capacités du système</span>
                <div className="w-10 h-px bg-bf-green" />
              </div>
              <h2 className="text-4xl font-bold text-gray-900">
                Une technologie au service de la justice
              </h2>
              <p className="text-gray-500 mt-4 max-w-xl mx-auto">
                Des outils de surveillance certifiés, conçus pour garantir la conformité aux décisions judiciaires avec la plus haute fiabilité.
              </p>
            </div>

            {/* Bento grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Large card — left */}
              <div className="md:col-span-2 bg-bf-green rounded-3xl p-8 flex flex-col justify-between min-h-64 relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-white/5" />
                <div className="absolute -right-4 -bottom-4 w-32 h-32 rounded-full bg-white/5" />
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-5">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">Géolocalisation sécurisée en temps réel</h3>
                  <p className="text-white/70 leading-relaxed max-w-lg">
                    Positionnement continu avec précision certifiée. Mise à jour automatique et transmission chiffrée des coordonnées vers les agents habilités, 24h/24.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-bf-gold animate-pulse" />
                  <span className="text-sm text-white/60 font-medium">Actif en permanence</span>
                </div>
              </div>

              {/* Alert card */}
              <div className="bg-gray-900 rounded-3xl p-7 flex flex-col justify-between min-h-64">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-bf-red/20 flex items-center justify-center mb-5">
                    <Zap className="w-6 h-6 text-bf-red" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Alertes instantanées</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Notification immédiate des agents et du juge responsable dès qu'un incident est détecté.
                  </p>
                </div>
                <div className="mt-4 px-3 py-2 bg-bf-red/10 rounded-xl border border-bf-red/20">
                  <p className="text-xs text-bf-red font-semibold">Délai &lt; 2 secondes</p>
                </div>
              </div>

              {/* Geofence card */}
              <div className="bg-white rounded-3xl p-7 border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
                  <Eye className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Périmètres configurables</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Le juge définit les zones d'inclusion et d'exclusion géographique, personnalisées selon l'ordonnance.
                </p>
              </div>

              {/* Gold card */}
              <div className="bg-bf-gold rounded-3xl p-7 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-gray-900/10 flex items-center justify-center mb-5">
                    <Lock className="w-6 h-6 text-gray-900" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Données chiffrées</h3>
                  <p className="text-gray-800 text-sm leading-relaxed">
                    Chiffrement de bout en bout. Accès strictement limité aux personnels judiciaires habilités.
                  </p>
                </div>
              </div>

              {/* Audit card */}
              <div className="bg-institutional rounded-3xl p-7 border border-gray-100">
                <div className="w-12 h-12 rounded-2xl bg-bf-green/10 flex items-center justify-center mb-5">
                  <CheckCircle className="w-6 h-6 text-bf-green" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Traçabilité complète</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Journal d'audit immuable. Chaque action est enregistrée et conservée conformément au droit burkinabè.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══ CTA ═══════════════════════════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-bf-green relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #fff 0%, transparent 60%)' }} />
          <div className="relative max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 text-sm font-medium text-white/90 mb-6">
              <div className="w-1.5 h-1.5 rounded-full bg-bf-gold" />
              Initiative Présidentielle
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
              Une justice qui réhabilite<br />autant qu&apos;elle protège
            </h2>
            <p className="text-white/75 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
              Découvrez comment le programme national de surveillance électronique transforme l&apos;approche judiciaire du Burkina Faso, en plaçant la dignité humaine au cœur de la procédure.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/initiative"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white text-bf-green font-bold text-sm hover:bg-bf-gold hover:text-gray-900 transition-all shadow-lg"
              >
                L&apos;Initiative Présidentielle <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/fonctionnement"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition-all"
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
