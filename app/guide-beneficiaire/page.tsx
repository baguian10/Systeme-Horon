import { BookOpen, Shield, Clock, MapPin, Phone, AlertTriangle, CheckCircle, FileText, Wifi, ChevronRight } from 'lucide-react';
import SiteHeader from '@/components/public/SiteHeader';
import SiteFooter from '@/components/public/SiteFooter';
import PrintButton from './PrintButton';

export const metadata = {
  title: 'Guide du bénéficiaire — Système Horon',
  description: 'Tout ce que vous devez savoir sur votre programme TIG : droits, obligations, bracelet GPS et contacts utiles.',
};

const RIGHTS = [
  'Être informé de la nature exacte de vos obligations avant le début du programme',
  'Exercer votre activité professionnelle normale en dehors des heures TIG',
  'Recevoir une attestation officielle à la fin de chaque journée de prestation',
  'Contacter votre juge référent à tout moment via l\'infoline SIGEP',
  'Être accompagné d\'un conseil lors de toute audition relative à votre dossier',
  'Obtenir un certificat de fin de programme TIG à l\'issue de votre peine',
];

const OBLIGATIONS = [
  { icon: Clock, title: 'Respecter les horaires', desc: 'Se présenter à l\'heure convenue sur le site TIG. Tout retard de plus de 30 minutes est comptabilisé comme absence.' },
  { icon: MapPin, title: 'Rester dans la zone autorisée', desc: 'Le bracelet GPS surveille votre position 24h/24. Toute sortie de la zone fixée par le juge déclenche une alerte immédiate.' },
  { icon: Shield, title: 'Ne pas altérer le bracelet', desc: 'Toute tentative de retrait, coupe ou altération du dispositif constitue une infraction grave entraînant la révocation du programme.' },
  { icon: Phone, title: 'Rester joignable', desc: 'Vous devez rester joignable par téléphone à tout moment par votre agent de surveillance. Indiquez tout changement de numéro.' },
  { icon: FileText, title: 'Signer le registre de présence', desc: 'À chaque prestation TIG, signez le registre du site d\'accueil. Ce document fait foi en cas de litige.' },
  { icon: Wifi, title: 'Charger le bracelet', desc: 'Le bracelet doit rester chargé. Vous recevrez une alerte SMS quand la batterie descend sous 20%. Chargez-le chaque nuit.' },
];

const BRACELET_STEPS = [
  { step: '1', title: 'Pose au bureau SIGEP', desc: 'Un technicien pose le bracelet à votre cheville lors d\'une session de 30 min. L\'ajustement est vérifié par un médecin.' },
  { step: '2', title: 'Activation', desc: 'Le bracelet est activé et synchronisé avec le serveur SIGEP. Vous recevez vos identifiants de référence.' },
  { step: '3', title: 'Formation rapide', desc: 'L\'agent vous explique comment charger l\'appareil, les zones autorisées et les numéros d\'urgence à appeler.' },
  { step: '4', title: 'Suivi continu', desc: 'Le bracelet envoie votre position toutes les 30 secondes. En cas d\'anomalie, votre agent est alerté automatiquement.' },
];

const EMERGENCY_CONTACTS = [
  { label: 'Infoline SIGEP (24h/24)', number: '+226 25 33 06 19', color: 'bg-emerald-600' },
  { label: 'Urgences judiciaires',    number: '+226 25 30 60 63', color: 'bg-blue-600' },
  { label: 'Police nationale',        number: '17',               color: 'bg-red-600' },
];

export default function GuideBeneficiairePage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-white pt-16">

      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950 text-white py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-emerald-600/20 border border-emerald-500/30 rounded-full px-4 py-1.5 text-xs font-semibold text-emerald-300 mb-6">
            <BookOpen className="w-3.5 h-3.5" />
            Document officiel — Ministère de la Justice
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            Guide du bénéficiaire<br />
            <span className="text-emerald-400">Programme TIG — Système Horon</span>
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed mb-8">
            Ce guide vous explique simplement tout ce que vous devez savoir sur votre programme de Travaux d'Intérêt Général :
            vos droits, vos obligations, le fonctionnement du bracelet GPS et les contacts en cas de besoin.
          </p>
          <div className="flex flex-wrap gap-3">
            <PrintButton />
            <a href="/contact" className="inline-flex items-center gap-2 border border-white/20 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors print:hidden">
              <Phone className="w-4 h-4" />
              Contacter un agent
            </a>
          </div>
        </div>
      </section>

      {/* Sommaire rapide */}
      <section className="border-b border-gray-100 py-6 px-6 print:hidden">
        <div className="max-w-4xl mx-auto flex flex-wrap gap-3">
          {['Vos droits', 'Vos obligations', 'Le bracelet GPS', 'En cas de problème', 'Contacts'].map((s, i) => (
            <a
              key={s}
              href={`#section-${i + 1}`}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-emerald-700 font-medium transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              {s}
            </a>
          ))}
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-6 py-14 space-y-16">

        {/* Section 1 — Vos droits */}
        <section id="section-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Section 1</p>
              <h2 className="text-2xl font-bold text-gray-900">Vos droits</h2>
            </div>
          </div>
          <p className="text-gray-600 mb-6 leading-relaxed">
            En tant que bénéficiaire du programme TIG, vous bénéficiez de droits garantis par l'ordonnance du Tribunal de Grande Instance.
            Ces droits ne peuvent pas être supprimés.
          </p>
          <ul className="space-y-3">
            {RIGHTS.map((right, i) => (
              <li key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-800 leading-relaxed">{right}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 2 — Vos obligations */}
        <section id="section-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Section 2</p>
              <h2 className="text-2xl font-bold text-gray-900">Vos obligations</h2>
            </div>
          </div>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Le non-respect de ces obligations peut entraîner une procédure de révocation et la conversion de votre TIG
            en peine d'emprisonnement ferme (Art. 28 du Code Pénal burkinabè).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {OBLIGATIONS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-5 rounded-2xl border border-gray-100 bg-white hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-gray-600" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">{title}</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3 — Le bracelet GPS */}
        <section id="section-3">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center flex-shrink-0">
              <Wifi className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Section 3</p>
              <h2 className="text-2xl font-bold text-gray-900">Le bracelet GPS SIGEP-G3</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 rounded-2xl p-6">
              <h3 className="font-bold text-gray-900 mb-4">Caractéristiques</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                {[
                  'Résistant à l\'eau (IP67) — vous pouvez vous doucher',
                  'Autonomie batterie : 72 heures',
                  'Chargeur magnétique fourni (1h de charge)',
                  'Poids : 68g — port continu sans gêne',
                  'Capteur anti-sabotage intégré',
                  'Signal GPS précis à ± 5 mètres',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                À ne jamais faire
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {[
                  'Tenter de retirer ou couper le bracelet',
                  'Envelopper le bracelet dans du métal ou aluminium',
                  'Laisser la batterie se décharger complètement',
                  'Plonger dans l\'eau plus de 30 minutes',
                  'Laisser quelqu\'un d\'autre porter le bracelet',
                  'Modifier ou altérer le boîtier électronique',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-red-200 text-red-700 text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">✕</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-gray-900 mb-4">Les 4 étapes du programme</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {BRACELET_STEPS.map(({ step, title, desc }) => (
                <div key={step} className="relative">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold text-lg flex items-center justify-center mb-3">
                    {step}
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-1">{title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4 — En cas de problème */}
        <section id="section-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Section 4</p>
              <h2 className="text-2xl font-bold text-gray-900">En cas de problème</h2>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { situation: 'Le bracelet émet une alerte sonore', action: 'Appelez immédiatement l\'infoline SIGEP (+226 25 33 06 19). Ne retirez pas le bracelet. Restez calme et attendez l\'instruction de l\'agent.' },
              { situation: 'Vous devez absolument sortir de votre zone', action: 'Appelez votre agent de surveillance AVANT de sortir. Une autorisation peut être accordée pour raisons médicales ou familiales urgentes. Sans appel préalable, c\'est une violation.' },
              { situation: 'Le bracelet ne charge plus', action: 'Signalez-le à votre agent dans les 2 heures. Un bracelet de remplacement vous sera fourni sous 24h. Ne tentez pas de réparer vous-même.' },
              { situation: 'Vous ne pouvez pas vous présenter au site TIG', action: 'Prévenez votre agent de surveillance et le responsable du site au moins 2h avant. Fournissez un justificatif (certificat médical, convocation officielle).' },
            ].map(({ situation, action }) => (
              <div key={situation} className="flex gap-4 p-5 rounded-2xl bg-amber-50 border border-amber-100">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-1">{situation}</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{action}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 5 — Contacts */}
        <section id="section-5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Phone className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Section 5</p>
              <h2 className="text-2xl font-bold text-gray-900">Contacts utiles</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {EMERGENCY_CONTACTS.map(({ label, number, color }) => (
              <a
                key={label}
                href={`tel:${number.replace(/\s/g, '')}`}
                className={`${color} text-white rounded-2xl p-5 hover:opacity-90 transition-opacity`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-2">{label}</p>
                <p className="text-2xl font-bold">{number}</p>
              </a>
            ))}
          </div>
          <div className="mt-6 bg-gray-50 rounded-2xl p-5">
            <p className="text-sm font-semibold text-gray-800 mb-1">Bureau SIGEP — Ministère de la Justice</p>
            <p className="text-sm text-gray-600">Avenue de l'Indépendance, Ouagadougou, Burkina Faso</p>
            <p className="text-sm text-gray-500 mt-1">Lun–Ven : 07h30–12h30 et 15h00–17h30</p>
          </div>
        </section>

        {/* Print footer */}
        <div className="hidden print:block border-t pt-6 text-xs text-gray-500 text-center">
          Document officiel — Ministère de la Justice et des Droits Humains du Burkina Faso — Système Horon
        </div>
      </div>
    </main>
      <SiteFooter />
    </>
  );
}
