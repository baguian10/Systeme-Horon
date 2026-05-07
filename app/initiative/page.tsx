import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, Heart, Users, Shield, Scale, TrendingDown,
  BookOpen, Star, ArrowLeft, Shovel, Clock, MapPin,
} from 'lucide-react';
import SiteHeader from '@/components/public/SiteHeader';
import SiteFooter from '@/components/public/SiteFooter';

export const metadata = {
  title: "L'Initiative Présidentielle — Système Horon · Burkina Faso",
  description: "Le programme national TIG : permettre aux condamnés de servir la communauté sous surveillance électronique stricte, une alternative humaine à la détention.",
};

const PILLARS = [
  {
    icon: <Shovel className="w-6 h-6" />,
    color: 'bg-emerald-50 text-emerald-700',
    title: 'Travail actif pour la communauté',
    desc: "Les bénéficiaires du TIG contribuent activement à la société — agriculture, travaux publics, entretien d'espaces verts — tout en demeurant sous surveillance électronique stricte.",
  },
  {
    icon: <TrendingDown className="w-6 h-6" />,
    color: 'bg-blue-50 text-blue-700',
    title: 'Réduction de la surpopulation',
    desc: "Les établissements pénitentiaires burkinabè font face à des défis structurels. Le TIG libère des places pour les condamnés nécessitant un encadrement strict, tout en réduisant significativement les coûts.",
  },
  {
    icon: <Heart className="w-6 h-6" />,
    color: 'bg-rose-50 text-rose-700',
    title: 'Dignité et réinsertion sociale',
    desc: "En maintenant les liens professionnels et familiaux, le programme favorise une réinsertion durable. Les statistiques montrent que les bénéficiaires du TIG récidivent 73% moins que ceux incarcérés.",
  },
  {
    icon: <Shield className="w-6 h-6" />,
    color: 'bg-amber-50 text-amber-700',
    title: 'Sécurité nationale préservée',
    desc: "La surveillance continue assure que les obligations judiciaires sont respectées. Les périmètres configurables par les juges garantissent que la protection de la communauté n'est jamais compromise.",
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
  { value: '73%', label: 'Réduction de la récidive',              color: 'text-emerald-600' },
  { value: '60%', label: 'Réduction du coût de détention',        color: 'text-amber-600' },
  { value: '85%', label: "Taux de conformité aux ordonnances",    color: 'text-blue-600' },
  { value: '3×',  label: 'Meilleure réinsertion professionnelle', color: 'text-rose-600' },
];

const TIG_STEPS = [
  { icon: <Scale className="w-5 h-5" />,   step: '01', label: 'Décision judiciaire', desc: "Le tribunal prononce une peine de TIG en lieu et place d'une peine d'emprisonnement ferme pour les infractions non graves." },
  { icon: <MapPin className="w-5 h-5" />,  step: '02', label: 'Équipement électronique', desc: "Le condamné est équipé d'un bracelet de surveillance sécurisé. Les zones de travail et de résidence sont configurées par le juge." },
  { icon: <Clock className="w-5 h-5" />,   step: '03', label: "Réalisation des travaux", desc: "Le bénéficiaire effectue ses heures de TIG dans les secteurs assignés, sous contrôle électronique continu et rapports périodiques." },
];

export default function InitiativePage() {
  return (
    <>
      <SiteHeader />
      <main>

        {/* ══ PAGE HERO ════════════════════════════════════════════════════════ */}
        <section className="relative pt-40 pb-24 px-6 bg-slate-900 overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=2000"
              alt=""
              fill
              priority
              className="object-cover opacity-10"
            />
          </div>
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-600 via-amber-500 to-red-600" />
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-emerald-600/5 -translate-y-1/2 translate-x-1/2 blur-3xl" />

          <div className="relative max-w-4xl mx-auto">
            <Link href="/" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-10 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Accueil
            </Link>

            <div className="inline-flex items-center gap-2 bg-emerald-600/15 border border-emerald-500/25 rounded-full px-4 py-1.5 text-sm font-medium text-emerald-300 mb-6">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              Burkina Faso — Programme National
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
              L&apos;Initiative<br />
              <span className="text-emerald-400">Présidentielle</span>
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl leading-relaxed">
              Une vision audacieuse pour une justice active : permettre aux condamnés de servir la société par le travail communautaire, sous surveillance électronique stricte, dans le respect de leur dignité.
            </p>
          </div>
        </section>

        {/* ══ TIG EXPLANATION ══════════════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5 mb-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Travaux d&apos;Intérêt Général</span>
                </div>
                <h2 className="text-4xl font-bold text-slate-900 leading-tight mb-5">
                  Servir sa peine en servant la communauté
                </h2>
                <p className="text-slate-600 leading-relaxed mb-5 text-lg">
                  Le TIG est une mesure judiciaire alternative à l&apos;emprisonnement. Plutôt que d&apos;enfermer des personnes condamnées pour des infractions mineures, l&apos;État burkinabè leur permet de rembourser leur dette envers la société par un travail concret et bénéfique.
                </p>
                <p className="text-slate-500 leading-relaxed mb-8">
                  Le Système Horon fournit le cadre technologique qui rend ce programme possible à grande échelle : localisation en temps réel, alertes automatiques, et rapports judiciaires consolidés pour chaque bénéficiaire.
                </p>

                <div className="space-y-4">
                  {TIG_STEPS.map((s) => (
                    <div key={s.step} className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                        {s.icon}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{s.label}</p>
                        <p className="text-sm text-slate-500 leading-relaxed mt-0.5">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl shadow-slate-200">
                  <Image
                    src="https://images.unsplash.com/photo-1594708767771-a7502209ff51?q=80&w=1200"
                    alt="Travaux d'intérêt général au Burkina Faso"
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl p-4">
                      <p className="text-white font-semibold text-sm">Programme TIG — Burkina Faso</p>
                      <p className="text-white/70 text-xs mt-1">Travaux communautaires sous surveillance électronique</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ PHILOSOPHY ═══════════════════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-10 h-px bg-emerald-600" />
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">La philosophie</span>
                <div className="w-10 h-px bg-emerald-600" />
              </div>
              <h2 className="text-4xl font-bold text-slate-900 mb-5">
                Réformer sans renoncer à la sécurité
              </h2>
              <p className="text-slate-500 text-lg leading-relaxed">
                Le Système Horon repose sur une conviction fondamentale : une société juste n&apos;emprisonne pas par défaut. Elle protège, elle surveille, elle accompagne — et elle offre la possibilité de se réhabiliter par le travail.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {PILLARS.map((p) => (
                <div key={p.title} className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className={`w-12 h-12 rounded-xl ${p.color} flex items-center justify-center mb-5`}>
                    {p.icon}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">{p.title}</h3>
                  <p className="text-slate-500 leading-relaxed text-sm">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ QUOTE ════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-slate-900 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #059669 0%, transparent 60%)' }} />
          <div className="relative max-w-4xl mx-auto text-center">
            <div className="text-8xl text-emerald-600/30 font-serif leading-none mb-4">&ldquo;</div>
            <blockquote className="text-2xl md:text-3xl font-light text-white leading-relaxed mb-8">
              La grandeur d&apos;un système judiciaire se mesure non pas à la sévérité de ses peines, mais à la sagesse avec laquelle il distingue la punition nécessaire de la précaution suffisante.
            </blockquote>
            <p className="text-emerald-400 font-semibold text-sm uppercase tracking-widest">
              Principes directeurs du Programme National de Surveillance Électronique
            </p>
          </div>
        </section>

        {/* ══ IMPACT STATS ════════════════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-10 h-px bg-emerald-600" />
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Impact mesuré</span>
                <div className="w-10 h-px bg-emerald-600" />
              </div>
              <h2 className="text-4xl font-bold text-slate-900">Les résultats parlent</h2>
              <p className="text-slate-500 mt-3 max-w-lg mx-auto">
                Des données collectées sur des programmes similaires à l&apos;échelle internationale et adaptées au contexte burkinabè.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {IMPACTS.map((s) => (
                <div key={s.label} className="text-center bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <p className={`text-4xl font-bold ${s.color} mb-2`}>{s.value}</p>
                  <p className="text-xs text-slate-500 font-medium leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ VALUES ══════════════════════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Les valeurs fondatrices</h2>
              <p className="text-slate-500">Les principes qui guident chaque décision du programme.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {VALUES.map((v) => (
                <div key={v.label} className="flex items-center gap-3 bg-white rounded-xl px-5 py-4 border border-slate-100 shadow-sm">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    {v.icon}
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CTA ══════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-slate-900">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Comment fonctionne le système ?</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
              De l&apos;ordonnance judiciaire à la surveillance en temps réel — découvrez le processus complet et les capacités techniques du Système Horon.
            </p>
            <Link
              href="/fonctionnement"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-colors shadow-lg"
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
