import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, FileText, Settings, Radio,
  MapPin, Shield, Activity, AlertTriangle, Lock,
  Wifi, CheckCircle, Eye, Clock,
} from 'lucide-react';
import SiteHeader from '@/components/public/SiteHeader';
import SiteFooter from '@/components/public/SiteFooter';

export const metadata = {
  title: 'Fonctionnement — Système Horon · Burkina Faso',
  description: "Comment le programme de surveillance électronique fonctionne : de l'ordonnance judiciaire à la surveillance en temps réel.",
};

const STEPS = [
  {
    number: '01',
    icon: <FileText className="w-7 h-7" />,
    title: 'Ordonnance judiciaire',
    color: 'bg-bf-green text-white',
    ring: 'ring-bf-green/20',
    desc: "Le juge d'instruction ou le tribunal évalue le dossier et prononce une ordonnance de placement sous surveillance électronique comme alternative à la détention provisoire.",
    details: [
      'Évaluation de la dangerosité et des risques de fuite',
      'Définition des conditions : périmètre, horaires, obligations',
      'Notification au prévenu et à son conseil juridique',
      'Transmission immédiate au système SIGEP',
    ],
  },
  {
    number: '02',
    icon: <Settings className="w-7 h-7" />,
    title: 'Équipement & configuration',
    color: 'bg-gray-900 text-white',
    ring: 'ring-gray-200',
    desc: 'Un agent SIGEP spécialisé procède à la pose du dispositif électronique sécurisé et configure l'ensemble des paramètres selon les termes exacts de l'ordonnance.',
    details: [
      'Pose du Dispositif Électronique Sécurisé certifié',
      'Configuration des périmètres géographiques autorisés',
      'Paramétrage des plages horaires de présence obligatoire',
      'Vérification du bon fonctionnement et formation du prévenu',
    ],
  },
  {
    number: '03',
    icon: <Radio className="w-7 h-7" />,
    title: 'Surveillance & suivi continu',
    color: 'bg-bf-gold text-gray-900',
    ring: 'ring-yellow-200',
    desc: 'Le centre de monitoring opère 24h/24, 7j/7. Toute anomalie déclenche immédiatement une alerte vers les agents de terrain et le juge responsable du dossier.',
    details: [
      'Localisation continue et transmission sécurisée des données',
      'Vérification automatique du respect des périmètres définis',
      'Alertes instantanées en cas de franchissement non autorisé',
      'Rapports périodiques transmis au magistrat responsable',
    ],
  },
];

const TECH_FEATURES = [
  {
    icon: <MapPin className="w-6 h-6" />,
    title: 'Localisation en temps réel',
    desc: 'Positionnement continu avec précision certifiée, mis à jour toutes les 30 secondes en zone active. Les données sont chiffrées et transmises de manière sécurisée.',
    tag: 'GPS / GNSS',
    accent: 'bg-bf-green text-white',
    size: 'lg',
  },
  {
    icon: <Eye className="w-6 h-6" />,
    title: 'Périmètres configurables',
    desc: "Le magistrat définit des zones d'inclusion (domicile, lieu de travail) et d'exclusion (zone de la victime, tribunal). Chaque périmètre est personnalisé selon l'ordonnance.",
    tag: 'Géofencing',
    accent: 'bg-blue-600 text-white',
    size: 'sm',
  },
  {
    icon: <AlertTriangle className="w-6 h-6" />,
    title: 'Détection de manipulation',
    desc: "Capteurs certifiés détectant toute tentative de retrait ou de sabotage du dispositif. Déclenchement immédiat d'une alerte de niveau maximum.",
    tag: 'Anti-sabotage',
    accent: 'bg-bf-red text-white',
    size: 'sm',
  },
  {
    icon: <Activity className="w-6 h-6" />,
    title: 'Surveillance de l'état de santé',
    desc: 'Monitoring continu des paramètres physiologiques. Détection des situations de détresse médicale avec notification automatique des secours.',
    tag: 'Santé',
    accent: 'bg-purple-600 text-white',
    size: 'sm',
  },
  {
    icon: <Lock className="w-6 h-6" />,
    title: 'Chiffrement de bout en bout',
    desc: 'Toutes les données transmises sont chiffrées selon les standards gouvernementaux les plus stricts. Aucune donnée n'est accessible sans accréditation judiciaire.',
    tag: 'Sécurité des données',
    accent: 'bg-gray-900 text-white',
    size: 'sm',
  },
  {
    icon: <Wifi className="w-6 h-6" />,
    title: 'Connectivité redondante',
    desc: 'Le dispositif utilise plusieurs réseaux de communication en parallèle pour garantir une disponibilité maximale, même dans les zones à couverture limitée.',
    tag: 'Résilience',
    accent: 'bg-bf-gold text-gray-900',
    size: 'sm',
  },
];

const LEGAL = [
  { icon: <FileText className="w-4 h-4" />,    label: 'Code de procédure pénale du Burkina Faso' },
  { icon: <Shield className="w-4 h-4" />,       label: 'Loi sur la protection des données personnelles' },
  { icon: <CheckCircle className="w-4 h-4" />,  label: 'Normes internationales des droits de l'homme' },
  { icon: <Lock className="w-4 h-4" />,         label: 'Charte africaine des droits de l'homme et des peuples' },
  { icon: <Clock className="w-4 h-4" />,         label: 'Règles minima des Nations Unies (Règles Nelson Mandela)' },
];

export default function FonctionnementPage() {
  return (
    <>
      <SiteHeader />
      <main>

        {/* ══ PAGE HERO ════════════════════════════════════════════════════════ */}
        <section className="relative pt-32 pb-20 px-6 bg-gray-950 overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-bf-green/5 -translate-y-1/3 translate-x-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-bf-gold/5 translate-y-1/2 -translate-x-1/4 blur-2xl" />

          <div className="relative max-w-4xl mx-auto">
            <Link href="/" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-white text-sm mb-8 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Accueil
            </Link>

            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm font-medium text-white/80 mb-6">
              <div className="w-2 h-2 rounded-full bg-bf-green animate-pulse" />
              Système opérationnel 24h/24
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
              Comment fonctionne<br />
              <span className="text-bf-gold">le Système Horon</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl leading-relaxed">
              De la décision judiciaire à la surveillance en temps réel — un processus rigoureux, transparent et respectueux des droits fondamentaux.
            </p>
          </div>
        </section>

        <div className="h-1 bg-gradient-to-r from-bf-green via-bf-gold to-bf-red" />

        {/* ══ 3 STEPS ══════════════════════════════════════════════════════════ */}
        <section className="py-28 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-10 h-px bg-bf-green" />
                <span className="text-xs font-bold text-bf-green uppercase tracking-widest">Le processus</span>
                <div className="w-10 h-px bg-bf-green" />
              </div>
              <h2 className="text-4xl font-bold text-gray-900">Trois étapes, une justice équilibrée</h2>
            </div>

            <div className="space-y-8 max-w-5xl mx-auto">
              {STEPS.map((step, idx) => (
                <div key={step.number} className="flex gap-6 md:gap-10 items-start group">
                  {/* Step indicator */}
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <div className={`w-16 h-16 rounded-2xl ${step.color} ring-4 ${step.ring} flex flex-col items-center justify-center shadow-lg`}>
                      {step.icon}
                      <span className="text-[9px] font-bold opacity-70 mt-0.5">{step.number}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className="w-px flex-1 bg-gradient-to-b from-gray-200 to-transparent mt-3 min-h-8" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 bg-institutional rounded-3xl p-7 border border-gray-100 group-hover:shadow-md transition-all mb-2">
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">{step.title}</h3>
                    <p className="text-gray-600 leading-relaxed mb-5">{step.desc}</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {step.details.map((d) => (
                        <li key={d} className="flex items-start gap-2 text-sm text-gray-500">
                          <CheckCircle className="w-4 h-4 text-bf-green flex-shrink-0 mt-0.5" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ TECH FEATURES BENTO ══════════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-institutional">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-10 h-px bg-bf-green" />
                <span className="text-xs font-bold text-bf-green uppercase tracking-widest">Capacités techniques</span>
                <div className="w-10 h-px bg-bf-green" />
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-3">
                Le Dispositif Électronique Sécurisé
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                Certifié pour usage judiciaire, le bracelet de sûreté combine précision, fiabilité et respect de la confidentialité des données personnelles.
              </p>
            </div>

            {/* Bento */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Large feature */}
              <div className="md:col-span-2 bg-bf-green rounded-3xl p-8 flex flex-col justify-between min-h-72 relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 w-56 h-56 rounded-full bg-white/5" />
                <div className="absolute right-8 bottom-8 w-32 h-32 rounded-full bg-white/5" />
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-5">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-bold text-white/60 uppercase tracking-widest mb-2 block">GPS / GNSS</span>
                  <h3 className="text-2xl font-bold text-white mb-3">Localisation en temps réel</h3>
                  <p className="text-white/70 max-w-lg leading-relaxed">
                    Positionnement continu avec précision certifiée, mis à jour toutes les 30 secondes en zone active. Les données sont chiffrées et transmises de manière sécurisée vers les agents habilités.
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <div className="w-2 h-2 rounded-full bg-bf-gold animate-pulse" />
                  <span className="text-sm text-white/60">Mise à jour toutes les 30 secondes</span>
                </div>
              </div>

              {/* Anti-tamper */}
              <div className="bg-gray-900 rounded-3xl p-7 flex flex-col">
                <div className="w-12 h-12 rounded-2xl bg-bf-red/20 flex items-center justify-center mb-5">
                  <AlertTriangle className="w-6 h-6 text-bf-red" />
                </div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Anti-sabotage</span>
                <h3 className="text-xl font-bold text-white mb-3">Détection de manipulation</h3>
                <p className="text-gray-400 text-sm leading-relaxed flex-1">
                  Capteurs certifiés détectant toute tentative de retrait ou de sabotage. Alerte de niveau maximum déclenchée instantanément.
                </p>
                <div className="mt-4 px-3 py-2 bg-bf-red/10 rounded-xl border border-bf-red/20">
                  <p className="text-xs text-bf-red font-semibold">Alerte immédiate — Niveau 5</p>
                </div>
              </div>

              {/* Geofencing */}
              <div className="bg-white rounded-3xl p-7 border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                  <Eye className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2 block">Géofencing</span>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Périmètres configurables</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Zones d'inclusion et d'exclusion définies par le magistrat selon les termes exacts de l'ordonnance.
                </p>
              </div>

              {/* Health */}
              <div className="bg-white rounded-3xl p-7 border border-gray-100 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mb-4">
                  <Activity className="w-6 h-6 text-purple-600" />
                </div>
                <span className="text-xs font-bold text-purple-600 uppercase tracking-widest mb-2 block">Santé</span>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Surveillance médicale</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Monitoring des paramètres vitaux. Détection des détresses médicales avec notification automatique.
                </p>
              </div>

              {/* Gold card — data security */}
              <div className="bg-bf-gold rounded-3xl p-7 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-gray-900/10 flex items-center justify-center mb-4">
                    <Lock className="w-6 h-6 text-gray-900" />
                  </div>
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-widest mb-2 block">Sécurité</span>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Chiffrement total</h3>
                  <p className="text-gray-800 text-sm leading-relaxed">
                    Chiffrement de bout en bout. Accès réservé aux personnels judiciaires accrédités.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ LEGAL FRAMEWORK ══════════════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Cadre légal & conformité</h2>
              <p className="text-gray-500">Le programme est fondé sur le respect strict des textes juridiques nationaux et internationaux.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LEGAL.map((l) => (
                <div key={l.label} className="flex items-center gap-3 bg-institutional rounded-2xl px-5 py-4 border border-gray-100">
                  <div className="w-8 h-8 rounded-xl bg-bf-green/10 text-bf-green flex items-center justify-center flex-shrink-0">
                    {l.icon}
                  </div>
                  <span className="text-sm text-gray-700 leading-snug">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CTA ══════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-bf-green">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">En savoir plus sur l'initiative</h2>
            <p className="text-white/70 mb-8 leading-relaxed">
              Découvrez la philosophie présidentielle qui a inspiré ce programme — une vision pour une justice burkinabè plus humaine et plus efficace.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/initiative"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white text-bf-green font-bold text-sm hover:bg-bf-gold hover:text-gray-900 transition-all shadow-lg"
              >
                L'Initiative Présidentielle <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition-all"
              >
                Retour à l'accueil
              </Link>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
