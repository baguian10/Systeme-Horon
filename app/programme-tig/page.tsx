import Link from 'next/link';
import {
  ArrowRight, Scale, Users, TreePine, Wrench,
  GraduationCap, Heart, CheckCircle, Clock,
  FileText, Shield, Landmark, AlertCircle,
} from 'lucide-react';
import SiteHeader from '@/components/public/SiteHeader';
import SiteFooter from '@/components/public/SiteFooter';

export const metadata = {
  title: 'Programme TIG — Système Horon · Burkina Faso',
  description: "Tout comprendre sur le Travail d'Intérêt Général (TIG) au Burkina Faso : principe, cadre légal, types de travaux et fonctionnement du suivi électronique.",
};

const WORK_TYPES = [
  {
    icon: TreePine,
    color: 'emerald',
    title: 'Environnement & espaces verts',
    examples: ['Entretien des jardins publics', 'Reboisement communal', 'Nettoyage des voiries', 'Gestion des déchets'],
  },
  {
    icon: Heart,
    color: 'red',
    title: 'Services de santé',
    examples: ['Soutien logistique aux CSPS', 'Entretien des locaux médicaux', 'Transport des non-urgences', 'Distribution de médicaments'],
  },
  {
    icon: GraduationCap,
    color: 'blue',
    title: 'Éducation & formation',
    examples: ['Entretien des établissements scolaires', 'Appui administratif', 'Encadrement parascolaire', 'Rénovation de salles de classe'],
  },
  {
    icon: Wrench,
    color: 'amber',
    title: 'Travaux d\'utilité publique',
    examples: ['Réfection de routes rurales', 'Construction de latrines', 'Entretien d\'ouvrages hydrauliques', 'Appui aux mairies'],
  },
  {
    icon: Users,
    color: 'purple',
    title: 'Action sociale & communautaire',
    examples: ['Soutien aux centres pour personnes âgées', 'Aide aux orphelinats agréés', 'Appui aux associations de quartier', 'Accompagnement des personnes vulnérables'],
  },
];

const STEPS = [
  {
    num: '01',
    icon: Scale,
    color: 'bg-emerald-600',
    title: 'Prononcé de la peine TIG',
    desc: "Le tribunal prononce une peine de TIG en lieu et place ou en complément d'une peine d'emprisonnement. Le bénéficiaire est informé de ses droits et obligations par le juge.",
    details: ['Audience correctionnelle ou tribunal', 'Nombre d\'heures fixé par le juge', 'Consentement du bénéficiaire obligatoire', 'Ordonnance transmise à SIGEP'],
  },
  {
    num: '02',
    icon: Shield,
    color: 'bg-blue-600',
    title: 'Équipement & affectation',
    desc: "Un agent SIGEP procède à la pose du bracelet GPS et affecte le bénéficiaire à un site TIG agréé selon ses compétences et la disponibilité des structures d'accueil.",
    details: ['Pose du bracelet GPS sécurisé', 'Création du périmètre de travail dans SIGEP', 'Affectation à un site agréé', 'Convention signée avec la structure d\'accueil'],
  },
  {
    num: '03',
    icon: FileText,
    color: 'bg-amber-500',
    title: 'Suivi et pointage',
    desc: "Le bénéficiaire se présente aux horaires définis. Sa présence sur le site est confirmée par le bracelet GPS. Le superviseur de la structure valide chaque journée effectuée.",
    details: ['Présence vérifiée via GPS en temps réel', 'Rapport hebdomadaire du superviseur', 'Alerte automatique en cas d\'absence', 'Comptabilisation des heures dans SIGEP'],
  },
  {
    num: '04',
    icon: CheckCircle,
    color: 'bg-emerald-700',
    title: 'Clôture & rapport final',
    desc: "À l'issue du nombre d'heures requis, un rapport de clôture est transmis au juge. Le bracelet est retiré et le dossier est archivé. Un certificat d'accomplissement peut être délivré.",
    details: ['Rapport de clôture signé par le superviseur', 'Transmission au juge pour validation', 'Retrait du bracelet par un agent SIGEP', 'Archivage et certificat d\'accomplissement'],
  },
];

const LEGAL_REFS = [
  { ref: 'Art. 44 à 52', text: 'Code pénal du Burkina Faso — Peine de Travail d\'Intérêt Général' },
  { ref: 'Art. 53 à 61', text: 'Code de procédure pénale — Modalités d\'exécution' },
  { ref: 'Loi n°010-2017', text: 'Régime de la surveillance électronique des peines' },
  { ref: 'Décret 2023-845', text: 'Modalités de déploiement du système SIGEP' },
];

const BENEFITS = [
  { icon: Shield,    label: 'Maintien des droits',   desc: 'Le bénéficiaire reste en liberté, garde son emploi et ses liens familiaux' },
  { icon: Users,     label: 'Réinsertion active',    desc: 'Le travail concret favorise la réhabilitation mieux qu\'une incarcération' },
  { icon: Landmark,  label: 'Économie pour l\'État', desc: '3 500 FCFA/jour/personne économisés par rapport à la détention' },
  { icon: Heart,     label: 'Bénéfice social',       desc: 'La communauté bénéficie directement du travail accompli' },
];

const COLOR = {
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', title: 'text-emerald-700', border: 'border-emerald-100' },
  red:     { bg: 'bg-red-50',     icon: 'text-red-600',     title: 'text-red-700',     border: 'border-red-100' },
  blue:    { bg: 'bg-blue-50',    icon: 'text-blue-600',    title: 'text-blue-700',    border: 'border-blue-100' },
  amber:   { bg: 'bg-amber-50',   icon: 'text-amber-600',   title: 'text-amber-700',   border: 'border-amber-100' },
  purple:  { bg: 'bg-purple-50',  icon: 'text-purple-600',  title: 'text-purple-700',  border: 'border-purple-100' },
};

export default function ProgrammeTigPage() {
  return (
    <>
      <SiteHeader />
      <main>

        {/* Hero */}
        <section className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white py-16">
          <div className="max-w-5xl mx-auto px-6">
            <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 text-xs font-semibold mb-5">
              <Scale className="w-3.5 h-3.5" /> Programme pénal alternatif
            </div>
            <h1 className="text-4xl font-bold mb-4 leading-tight">
              Travail d&apos;Intérêt Général (TIG)
            </h1>
            <p className="text-emerald-100 max-w-2xl leading-relaxed text-lg mb-8">
              Une alternative humaine et efficace à la détention provisoire. Le bénéficiaire rend service à la collectivité tout en conservant sa liberté sous surveillance électronique.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { val: '40–480 h', lbl: 'Durée légale du TIG' },
                { val: '7',        lbl: 'Sites agréés à Ouagadougou' },
                { val: '94 %',     lbl: 'Taux de réussite' },
                { val: '0 FCFA',   lbl: 'Coût pour le condamné' },
              ].map((s) => (
                <div key={s.lbl} className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                  <p className="text-2xl font-bold">{s.val}</p>
                  <p className="text-xs text-emerald-200 mt-0.5">{s.lbl}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Principe légal */}
        <section className="py-14 bg-white">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Qu&apos;est-ce que le TIG ?</h2>
                <p className="text-gray-600 leading-relaxed mb-4">
                  Le Travail d&apos;Intérêt Général est une peine alternative prononcée par le tribunal correctionnel ou la chambre criminelle. Il permet à un condamné d&apos;effectuer un travail non rémunéré au bénéfice d&apos;une collectivité publique ou d&apos;une association agréée, en lieu et place d&apos;une peine d&apos;emprisonnement ferme.
                </p>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Au Burkina Faso, le TIG est encadré par les articles 44 à 52 du Code pénal. Le système SIGEP assure le suivi électronique de l&apos;exécution via un bracelet GPS, garantissant la présence effective du bénéficiaire sur le site de travail.
                </p>
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Consentement obligatoire :</strong> Le TIG ne peut être prononcé qu&apos;avec le consentement explicite du condamné. Il peut refuser — dans ce cas, le tribunal prononce la peine d&apos;emprisonnement.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Références juridiques</p>
                {LEGAL_REFS.map((l) => (
                  <div key={l.ref} className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                    <span className="text-xs font-bold font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded flex-shrink-0">
                      {l.ref}
                    </span>
                    <p className="text-xs text-gray-600">{l.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Types de travaux */}
        <section className="py-14 bg-gray-50">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-900">Types de travaux reconnus</h2>
              <p className="text-gray-500 mt-2 text-sm">Activités éligibles au programme TIG dans la région du Centre</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {WORK_TYPES.map((w) => {
                const c = COLOR[w.color as keyof typeof COLOR];
                const Icon = w.icon;
                return (
                  <div key={w.title} className={`${c.bg} border ${c.border} rounded-2xl p-5`}>
                    <Icon className={`w-6 h-6 ${c.icon} mb-3`} />
                    <h3 className={`font-bold text-sm ${c.title} mb-3`}>{w.title}</h3>
                    <ul className="space-y-1.5">
                      {w.examples.map((ex) => (
                        <li key={ex} className="flex items-start gap-2 text-xs text-gray-600">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${c.icon.replace('text-', 'bg-')}`} />
                          {ex}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Processus */}
        <section className="py-14 bg-white">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-900">Déroulement du TIG avec SIGEP</h2>
              <p className="text-gray-500 mt-2 text-sm">De la décision judiciaire à la clôture du dossier</p>
            </div>
            <div className="space-y-6">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.num} className="flex items-start gap-5">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={`w-12 h-12 rounded-2xl ${step.color} flex items-center justify-center text-white`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className="w-0.5 h-8 bg-gray-200 mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-6">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-gray-400">ÉTAPE {step.num}</span>
                      </div>
                      <h3 className="text-base font-bold text-gray-900 mb-2">{step.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed mb-3">{step.desc}</p>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {step.details.map((d) => (
                          <li key={d} className="flex items-center gap-2 text-xs text-gray-600">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Bénéfices */}
        <section className="py-14 bg-emerald-700 text-white">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold mb-2">Pourquoi le TIG ?</h2>
              <p className="text-emerald-200 text-sm">Avantages pour toutes les parties prenantes</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {BENEFITS.map((b) => {
                const Icon = b.icon;
                return (
                  <div key={b.label} className="bg-white/10 rounded-2xl p-5 backdrop-blur-sm">
                    <Icon className="w-6 h-6 text-emerald-300 mb-3" />
                    <p className="font-bold text-white mb-1">{b.label}</p>
                    <p className="text-xs text-emerald-200 leading-relaxed">{b.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-12 bg-white">
          <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Votre juridiction souhaite rejoindre le programme ?</h2>
              <p className="text-sm text-gray-500 mt-1">Contactez le service SIGEP pour une démonstration et un accompagnement au déploiement.</p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <Link
                href="/fonctionnement"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Comment ça fonctionne
              </Link>
              <Link
                href="/#contact"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors"
              >
                Nous contacter <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
