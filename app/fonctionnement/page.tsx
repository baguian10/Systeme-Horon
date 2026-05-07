import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, FileText, Settings, Radio,
  MapPin, Shield, Activity, AlertTriangle, Lock,
  Wifi, CheckCircle, Eye, Clock, Bluetooth, Home,
} from 'lucide-react';
import SiteHeader from '@/components/public/SiteHeader';
import SiteFooter from '@/components/public/SiteFooter';

export const metadata = {
  title: 'Fonctionnement — Système Horon · Burkina Faso',
  description: "Comment le programme de surveillance électronique fonctionne : de l'ordonnance judiciaire à la surveillance en temps réel, incluant l'assignation à domicile par balise BLE.",
};

const STEPS = [
  {
    number: '01',
    icon: <FileText className="w-7 h-7" />,
    title: 'Ordonnance judiciaire',
    color: 'bg-emerald-600 text-white',
    ring: 'ring-emerald-100',
    desc: "Le juge d'instruction ou le tribunal évalue le dossier et prononce une ordonnance de placement sous surveillance électronique comme alternative à la détention provisoire ou à une peine d'emprisonnement ferme.",
    details: [
      'Évaluation de la dangerosité et des risques de fuite',
      'Définition des conditions : périmètre, horaires, obligations TIG',
      'Notification au prévenu et à son conseil juridique',
      'Transmission immédiate au système SIGEP',
    ],
  },
  {
    number: '02',
    icon: <Settings className="w-7 h-7" />,
    title: 'Équipement & configuration',
    color: 'bg-slate-700 text-white',
    ring: 'ring-slate-100',
    desc: "Un agent SIGEP spécialisé procède à la pose du dispositif électronique sécurisé et configure l'ensemble des paramètres selon les termes exacts de l'ordonnance. Pour les assignations à domicile, une balise BLE est également installée.",
    details: [
      'Pose du Dispositif Électronique Sécurisé certifié',
      'Configuration des périmètres géographiques autorisés',
      'Installation optionnelle de la balise BLE domicile',
      'Vérification du fonctionnement et formation du bénéficiaire',
    ],
  },
  {
    number: '03',
    icon: <Radio className="w-7 h-7" />,
    title: 'Surveillance & suivi continu',
    color: 'bg-amber-500 text-white',
    ring: 'ring-amber-100',
    desc: "Le centre de monitoring opère 24h/24, 7j/7. Toute anomalie déclenche immédiatement une alerte vers les agents de terrain et le juge responsable du dossier.",
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
    desc: "Positionnement continu avec précision certifiée, mis à jour toutes les 30 secondes en zone active.",
    tag: 'GPS / GNSS',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    size: 'lg',
  },
  {
    icon: <Eye className="w-6 h-6" />,
    title: 'Périmètres configurables',
    desc: "Le magistrat définit des zones d'inclusion et d'exclusion personnalisées selon l'ordonnance.",
    tag: 'Géofencing',
    color: 'bg-blue-50 text-blue-700 border-blue-100',
    size: 'sm',
  },
  {
    icon: <AlertTriangle className="w-6 h-6" />,
    title: 'Détection de manipulation',
    desc: "Capteurs certifiés détectant toute tentative de retrait ou de sabotage. Déclenchement immédiat d'une alerte de niveau maximum.",
    tag: 'Anti-sabotage',
    color: 'bg-red-50 text-red-700 border-red-100',
    size: 'sm',
  },
  {
    icon: <Activity className="w-6 h-6" />,
    title: "Surveillance de l'état de santé",
    desc: "Monitoring continu des paramètres physiologiques. Détection des situations de détresse médicale avec notification automatique des secours.",
    tag: 'Santé',
    color: 'bg-purple-50 text-purple-700 border-purple-100',
    size: 'sm',
  },
  {
    icon: <Lock className="w-6 h-6" />,
    title: 'Chiffrement de bout en bout',
    desc: "Toutes les données transmises sont chiffrées selon les standards gouvernementaux. Aucune donnée n'est accessible sans accréditation judiciaire.",
    tag: 'Sécurité',
    color: 'bg-slate-50 text-slate-700 border-slate-100',
    size: 'sm',
  },
  {
    icon: <Wifi className="w-6 h-6" />,
    title: 'Connectivité redondante',
    desc: "Le dispositif utilise plusieurs réseaux de communication en parallèle pour garantir une disponibilité maximale.",
    tag: 'Résilience',
    color: 'bg-amber-50 text-amber-700 border-amber-100',
    size: 'sm',
  },
];

const LEGAL = [
  { icon: <FileText className="w-4 h-4" />,   label: 'Code de procédure pénale du Burkina Faso' },
  { icon: <Shield className="w-4 h-4" />,      label: 'Loi sur la protection des données personnelles' },
  { icon: <CheckCircle className="w-4 h-4" />, label: "Normes internationales des droits de l'homme" },
  { icon: <Lock className="w-4 h-4" />,        label: "Charte africaine des droits de l'homme et des peuples" },
  { icon: <Clock className="w-4 h-4" />,        label: 'Règles minima des Nations Unies (Règles Nelson Mandela)' },
];

export default function FonctionnementPage() {
  return (
    <>
      <SiteHeader />
      <main>

        {/* ══ PAGE HERO ════════════════════════════════════════════════════════ */}
        <section className="relative pt-40 pb-24 px-6 bg-slate-900 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-600 via-amber-500 to-red-600" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-emerald-600/5 -translate-y-1/3 translate-x-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-amber-500/5 translate-y-1/2 -translate-x-1/4 blur-2xl" />

          <div className="relative max-w-4xl mx-auto">
            <Link href="/" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-10 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Accueil
            </Link>

            <div className="inline-flex items-center gap-2 bg-emerald-600/15 border border-emerald-500/25 rounded-full px-4 py-1.5 text-sm font-medium text-emerald-300 mb-6">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Système opérationnel 24h/24
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
              Comment fonctionne<br />
              <span className="text-emerald-400">le Système Horon</span>
            </h1>
            <p className="text-xl text-slate-300 max-w-2xl leading-relaxed">
              De la décision judiciaire à la surveillance en temps réel — un processus rigoureux, transparent et respectueux des droits fondamentaux.
            </p>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-emerald-600 via-amber-500 to-red-600" />

        {/* ══ 3 STEPS ══════════════════════════════════════════════════════════ */}
        <section className="py-28 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-10 h-px bg-emerald-600" />
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Le processus</span>
                <div className="w-10 h-px bg-emerald-600" />
              </div>
              <h2 className="text-4xl font-bold text-slate-900">Trois étapes, une justice équilibrée</h2>
            </div>

            <div className="space-y-8 max-w-5xl mx-auto">
              {STEPS.map((step, idx) => (
                <div key={step.number} className="flex gap-6 md:gap-10 items-start">
                  <div className="flex-shrink-0 flex flex-col items-center">
                    <div className={`w-16 h-16 rounded-2xl ${step.color} ring-4 ${step.ring} flex flex-col items-center justify-center shadow-lg`}>
                      {step.icon}
                      <span className="text-[9px] font-bold opacity-70 mt-0.5">{step.number}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className="w-px flex-1 bg-gradient-to-b from-slate-200 to-transparent mt-3 min-h-8" />
                    )}
                  </div>

                  <div className="flex-1 bg-slate-50 rounded-2xl p-7 border border-slate-100 mb-2">
                    <h3 className="text-2xl font-bold text-slate-900 mb-3">{step.title}</h3>
                    <p className="text-slate-600 leading-relaxed mb-5">{step.desc}</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {step.details.map((d) => (
                        <li key={d} className="flex items-start gap-2 text-sm text-slate-500">
                          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
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

        {/* ══ BLE BEACON SECTION ═══════════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-slate-900 relative overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/centre-controle-sigep.jpg"
              alt=""
              fill
              sizes="100vw"
              className="object-cover opacity-10"
            />
          </div>
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, #3b82f6 0%, transparent 60%)' }} />
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-blue-600/15 border border-blue-500/25 rounded-full px-4 py-1.5 text-sm font-medium text-blue-300 mb-6">
                  <Bluetooth className="w-3.5 h-3.5" />
                  Assignation à Domicile — Balise BLE
                </div>
                <h2 className="text-4xl font-bold text-white leading-tight mb-6">
                  Confinement domiciliaire par
                  <span className="text-blue-400"> Balise BLE</span>
                </h2>
                <p className="text-slate-300 leading-relaxed mb-5 text-lg">
                  Pour les ordonnances d&apos;assignation à domicile, le Système Horon déploie une balise Bluetooth Low Energy (BLE) installée au domicile du bénéficiaire. Appairée avec le bracelet électronique, elle permet un suivi de présence ultra-précis en intérieur, là où le GPS seul est insuffisant.
                </p>
                <p className="text-slate-400 leading-relaxed mb-8">
                  Le bracelet communique en permanence avec la balise BLE. Dès que le signal est perdu — indiquant que le bénéficiaire a quitté le domicile en dehors des heures autorisées — une alerte est immédiatement transmise aux agents de surveillance.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { icon: <Bluetooth className="w-4 h-4" />, label: 'Signal BLE continu', desc: 'Détection de présence dans un rayon configurable' },
                    { icon: <Home className="w-4 h-4" />,      label: 'Suivi intérieur précis', desc: "Là où le GPS seul est insuffisant" },
                    { icon: <Shield className="w-4 h-4" />,    label: 'Détection de sortie', desc: "Alerte instantanée si le signal est perdu" },
                    { icon: <Wifi className="w-4 h-4" />,      label: 'Double vérification', desc: 'GPS + BLE pour une fiabilité maximale' },
                  ].map((item) => (
                    <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                          {item.icon}
                        </div>
                        <span className="text-sm font-semibold text-white">{item.label}</span>
                      </div>
                      <p className="text-xs text-slate-400">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                    <Bluetooth className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-white font-bold">Schéma de fonctionnement</p>
                    <p className="text-slate-400 text-xs">Assignation à domicile par balise BLE</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { step: '1', label: 'Installation de la balise BLE au domicile', color: 'bg-blue-600' },
                    { step: '2', label: 'Appairage sécurisé avec le bracelet électronique', color: 'bg-emerald-600' },
                    { step: '3', label: 'Surveillance continue de la présence (signal BLE)', color: 'bg-emerald-600' },
                    { step: '4', label: 'Position GPS complémentaire pour les déplacements autorisés', color: 'bg-amber-500' },
                    { step: '5', label: 'Alerte immédiate en cas de perte de signal ou sortie de zone', color: 'bg-red-600' },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-7 h-7 rounded-lg ${item.color} flex items-center justify-center text-white text-xs font-bold`}>
                        {item.step}
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed pt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-xs text-slate-500 text-center">Technologie certifiée · Portée configurable 5 – 50 m · Compatible multi-réseaux</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ TECH FEATURES ════════════════════════════════════════════════════ */}
        <section className="py-24 px-6 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-10 h-px bg-emerald-600" />
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Capacités techniques</span>
                <div className="w-10 h-px bg-emerald-600" />
              </div>
              <h2 className="text-4xl font-bold text-slate-900 mb-3">
                Le Dispositif Électronique Sécurisé
              </h2>
              <p className="text-slate-500 max-w-xl mx-auto">
                Certifié pour usage judiciaire, le bracelet de sûreté combine précision, fiabilité et respect de la confidentialité des données personnelles.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Large GPS card */}
              <div className="md:col-span-2 bg-slate-900 rounded-2xl p-10 flex flex-col justify-between min-h-72 relative overflow-hidden">
                <Image
                  src="/suivi-precision.jpg"
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 66vw"
                  className="object-cover opacity-10"
                />
                <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-emerald-600/10" />
                <div className="absolute right-8 bottom-8 w-40 h-40 rounded-full bg-emerald-600/10" />
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-600/20 flex items-center justify-center mb-5">
                    <MapPin className="w-6 h-6 text-emerald-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">GPS / GNSS</span>
                  <h3 className="text-2xl font-bold text-white mb-3">Localisation en temps réel</h3>
                  <p className="text-slate-400 max-w-lg leading-relaxed">
                    Positionnement continu avec précision certifiée, mis à jour toutes les 30 secondes en zone active. Les données sont chiffrées et transmises de manière sécurisée vers les agents habilités.
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm text-slate-400">Mise à jour toutes les 30 secondes</span>
                </div>
              </div>

              {/* Anti-tamper */}
              <div className="bg-white rounded-2xl p-7 border border-slate-100 shadow-sm flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-5">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Anti-sabotage</span>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Détection de manipulation</h3>
                <p className="text-slate-500 text-sm leading-relaxed flex-1">
                  Capteurs certifiés détectant toute tentative de retrait ou de sabotage. Alerte de niveau maximum déclenchée instantanément.
                </p>
                <div className="mt-4 px-3 py-2 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-xs text-red-600 font-semibold">Alerte immédiate — Niveau 5</p>
                </div>
              </div>

              {/* Geofencing */}
              <div className="bg-white rounded-2xl p-7 border border-slate-100 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                  <Eye className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Géofencing</span>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Périmètres configurables</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Zones d&apos;inclusion et d&apos;exclusion définies par le magistrat selon les termes exacts de l&apos;ordonnance.
                </p>
              </div>

              {/* BLE */}
              <div className="bg-blue-600 rounded-2xl p-7 text-white">
                <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center mb-4">
                  <Bluetooth className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-2 block">Balise BLE</span>
                <h3 className="text-lg font-bold mb-2">Assignation à domicile</h3>
                <p className="text-blue-100 text-sm leading-relaxed">
                  Suivi de présence ultra-précis en intérieur via balise Bluetooth Low Energy appairée au bracelet.
                </p>
              </div>

              {/* Encryption */}
              <div className="bg-white rounded-2xl p-7 border border-slate-100 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                  <Lock className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Sécurité</span>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Chiffrement total</h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Chiffrement de bout en bout. Accès réservé aux personnels judiciaires accrédités.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══ LEGAL FRAMEWORK ══════════════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Cadre légal &amp; conformité</h2>
              <p className="text-slate-500">Le programme est fondé sur le respect strict des textes juridiques nationaux et internationaux.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {LEGAL.map((l) => (
                <div key={l.label} className="flex items-center gap-3 bg-slate-50 rounded-xl px-5 py-4 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    {l.icon}
                  </div>
                  <span className="text-sm text-slate-700 leading-snug">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CTA ══════════════════════════════════════════════════════════════ */}
        <section className="py-20 px-6 bg-slate-900">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">En savoir plus sur l&apos;initiative</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
              Découvrez la philosophie présidentielle qui a inspiré ce programme — une vision pour une justice burkinabè plus humaine et plus efficace.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/initiative"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-500 transition-colors shadow-lg"
              >
                L&apos;Initiative Présidentielle <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-slate-600 text-slate-200 font-semibold text-sm hover:bg-slate-800 transition-colors"
              >
                Retour à l&apos;accueil
              </Link>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
