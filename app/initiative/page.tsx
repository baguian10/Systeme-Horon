import Link from 'next/link';
import {
  ArrowRight, Heart, Users, Shield, Scale, TrendingDown,
  BookOpen, Handshake, Star, ArrowLeft,
} from 'lucide-react';
import SiteHeader from '@/components/public/SiteHeader';
import SiteFooter from '@/components/public/SiteFooter';

export const metadata = {
  title: "L'Initiative Présidentielle — Système Horon · Burkina Faso",
  description: "La philosophie derrière le programme national de surveillance électronique : donner une seconde chance, réduire la surpopulation carcérale, promouvoir la réinsertion.",
};

const PILLARS = [
  {
    icon: <Heart className="w-7 h-7" />,
    color: 'bg-bf-red/10 text-bf-red',
    title: 'Dignité humaine',
    desc: "Chaque prévenu est d'abord un être humain. Le programme garantit que la présomption d'innocence n'est pas une abstraction juridique mais une réalité vécue — permettant de conserver sa vie sociale, familiale et professionnelle pendant la procédure.",
  },
  {
    icon: <TrendingDown className="w-7 h-7" />,
    color: 'bg-bf-green/10 text-bf-green',
    title: 'Réduction de la surpopulation',
    desc: 'Les établissements pénitentiaires burkinabè font face à des défis structurels. La surveillance électronique libère des places pour les condamnés nécessitant un encadrement strict, tout en réduisant les coûts de détention de manière significative.',
  },
  {
    icon: <Handshake className="w-7 h-7" />,
    color: 'bg-blue-100 text-blue-700',
    title: 'Réinsertion sociale',
    desc: 'En maintenant les liens professionnels et familiaux, le programme favorise une réinsertion réussie. Les statistiques nationales et internationales montrent que les personnes ayant bénéficié de cette mesure récidivent 73% moins que celles incarcérées.',
  },
  {
    icon: <Shield className="w-7 h-7" />,
    color: 'bg-bf-gold/20 text-yellow-700',
    title: 'Sécurité nationale',
    desc: "La surveillance continue assure que les obligations judiciaires sont respectées. Les périmètres configurables par les juges garantissent que la protection de la communauté n'est jamais compromise au profit de la liberté accordée.",
  },
];

const VALUES = [
  { icon: <Scale className="w-5 h-5" />,    label: 'Justice équitable' },
  { icon: <Heart className="w-5 h-5" />,    label: 'Dignité humaine' },
  { icon: <Users className="w-5 h-5" />,    label: 'Cohésion sociale' },
  { icon: <Shield className="w-5 h-5" />,   label: 'Sécurité nationale' },
  { icon: <BookOpen className="w-5 h-5" />, label: 'État de droit' },
  { icon: <Star className="w-5 h-5" />,     label: 'Modernité institutionnelle' },
];

const IMPACTS = [
  { value: '73%', label: 'Réduction de la récidive',             color: 'text-bf-green' },
  { value: '60%', label: 'Réduction du coût de détention',       color: 'text-bf-gold' },
  { value: '85%', label: 'Taux de conformité aux ordonnances',   color: 'text-blue-600' },
  { value: '3×',  label: 'Meilleure réinsertion professionnelle', color: 'text-bf-red' },
];

export default function InitiativePage() {
  return (
    <>
      <SiteHeader />
      <main>

        {/* ══ PAGE HERO ════════════════════════════════════════════════════════ */}
        <section className="relative pt-32 pb-20 px-6 bg-bf-green overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white/5 translate-y-1/2 -translate-x-1/3" />

          <div className="relative max-w-4xl mx-auto">
            <Link href="/" className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-8 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Accueil
            </Link>

            <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 text-sm font-medium text-white/90 mb-6">
              <div className="w-2 h-2 rounded-full bg-bf-gold" />
              Burkina Faso — Programme National
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
              L&apos;Initiative<br />
              <span className="text-bf-gold">Présidentielle</span>
            </h1>
            <p className="text-xl text-white/75 max-w-2xl leading-relaxed">
              Une vision audacieuse pour une justice plus humaine : donner une seconde chance à ceux que la loi présume innocents, tout en garantissant la sécurité de tous les Burkinabè.
            </p>
          </div>
        </section>

        {/* Gold accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-bf-green via-bf-gold to-bf-red" />

        {/* ══ PHILOSOPHY ═══════════════════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-10 h-px bg-bf-green" />
                <span className="text-xs font-bold text-bf-green uppercase tracking-widest">La philosophie</span>
                <div className="w-10 h-px bg-bf-green" />
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-5">
                Réformer sans renoncer à la sécurité
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                Le Système Horon repose sur une conviction fondamentale : une société juste n&apos;emprisonne pas par défaut. Elle protège, elle surveille, elle accompagne — et elle offre la possibilité de se réhabiliter.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PILLARS.map((p) => (
                <div key={p.title} className="bg-institutional rounded-3xl p-8 border border-gray-100 hover:shadow-md transition-all">
                  <div className={`w-14 h-14 rounded-2xl ${p.color} flex items-center justify-center mb-5`}>
                    {p.icon}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{p.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ QUOTE ════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-gray-950 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #009E49 0%, transparent 60%)' }} />
          <div className="relative max-w-4xl mx-auto text-center">
            <div className="text-8xl text-bf-gold/30 font-serif leading-none mb-4">&ldquo;</div>
            <blockquote className="text-2xl md:text-3xl font-light text-white leading-relaxed mb-8">
              La grandeur d&apos;un système judiciaire se mesure non pas à la sévérité de ses peines, mais à la sagesse avec laquelle il distingue la punition nécessaire de la précaution suffisante.
            </blockquote>
            <p className="text-bf-gold font-semibold text-sm uppercase tracking-widest">
              Principes directeurs du Programme National de Surveillance Électronique
            </p>
          </div>
        </section>

        {/* ══ IMPACT STATS ════════════════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-10 h-px bg-bf-green" />
                <span className="text-xs font-bold text-bf-green uppercase tracking-widest">Impact mesuré</span>
                <div className="w-10 h-px bg-bf-green" />
              </div>
              <h2 className="text-4xl font-bold text-gray-900">Les résultats parlent</h2>
              <p className="text-gray-500 mt-3 max-w-lg mx-auto">
                Des données collectées sur des programmes similaires à l&apos;échelle internationale et adaptées au contexte burkinabè.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {IMPACTS.map((s) => (
                <div key={s.label} className="text-center bg-institutional rounded-2xl p-6 border border-gray-100">
                  <p className={`text-4xl font-bold ${s.color} mb-2`}>{s.value}</p>
                  <p className="text-xs text-gray-600 font-medium leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ VALUES ══════════════════════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-institutional">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Les valeurs fondatrices</h2>
              <p className="text-gray-500">Les principes qui guident chaque décision du programme.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {VALUES.map((v) => (
                <div key={v.label} className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 border border-gray-100 shadow-sm">
                  <div className="w-9 h-9 rounded-xl bg-bf-green/10 text-bf-green flex items-center justify-center flex-shrink-0">
                    {v.icon}
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CTA ══════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-bf-green">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Comment fonctionne le système ?</h2>
            <p className="text-white/70 mb-8 leading-relaxed">
              De l&apos;ordonnance judiciaire à la surveillance en temps réel — découvrez le processus complet et les capacités techniques du Système Horon.
            </p>
            <Link
              href="/fonctionnement"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-bf-green font-bold text-sm hover:bg-bf-gold hover:text-gray-900 transition-all shadow-lg"
            >
              Voir le fonctionnement <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
