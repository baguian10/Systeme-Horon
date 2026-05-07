import { Phone, Mail, MapPin, Clock, AlertTriangle, Shield, ExternalLink } from 'lucide-react';
import ContactForm from './ContactForm';
import SiteHeader from '@/components/public/SiteHeader';
import SiteFooter from '@/components/public/SiteFooter';

export const metadata = {
  title: 'Contact & Infoline — Système Horon',
  description: 'Contactez le programme national TIG du Burkina Faso : infoline, formulaire de contact et adresse du Ministère de la Justice.',
};

const EMERGENCY = [
  { label: 'Infoline SIGEP', sublabel: 'Urgences bracelet & surveillance', number: '+226 25 33 06 19', available: '24h/24 · 7j/7', color: 'bg-emerald-600' },
  { label: 'Urgences judiciaires', sublabel: 'Greffe TGI de Ouagadougou', number: '+226 25 30 60 63', available: 'Lun–Ven · 07h30–16h30', color: 'bg-blue-600' },
  { label: 'Police nationale', sublabel: 'Ligne d\'urgence nationale', number: '17', available: '24h/24 · 7j/7', color: 'bg-red-600' },
];

const OFFICES = [
  {
    title: 'Direction du Programme TIG — SIGEP',
    address: 'Avenue de l\'Indépendance, Koulouba',
    city: 'Ouagadougou, Burkina Faso',
    hours: 'Lun–Ven : 07h30–12h30 · 15h00–17h30',
    phone: '+226 25 33 06 19',
    email: 'sigep@justice.gov.bf',
    primary: true,
  },
  {
    title: 'Ministère de la Justice et des Droits Humains',
    address: 'Avenue Dimdolobsom, Zone du Bois',
    city: 'Ouagadougou 01, BP 526',
    hours: 'Lun–Ven : 07h30–12h30 · 15h00–17h30',
    phone: '+226 25 33 11 50',
    email: 'contact@justice.gov.bf',
    primary: false,
  },
  {
    title: 'Tribunal de Grande Instance — Ouagadougou',
    address: 'Avenue Babangida, Secteur 4',
    city: 'Ouagadougou, Burkina Faso',
    hours: 'Lun–Ven : 07h30–12h00 · 15h00–17h00',
    phone: '+226 25 30 60 63',
    email: 'greffe.tgi@justice.gov.bf',
    primary: false,
  },
];

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-gray-50 pt-16">

      {/* Header */}
      <section className="bg-white border-b border-gray-100 py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 leading-tight">Contact & Infoline</h1>
          <p className="text-gray-500 leading-relaxed">
            Plusieurs canaux sont disponibles selon la nature de votre demande — consultez la rubrique adaptée à votre situation.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Emergency contacts */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Numéros d&apos;urgence</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {EMERGENCY.map((e) => (
              <a
                key={e.label}
                href={`tel:${e.number.replace(/\s/g, '')}`}
                className={`${e.color} text-white rounded-2xl p-5 hover:opacity-90 transition-opacity block`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-4 h-4 opacity-80" />
                  <p className="text-xs font-bold uppercase tracking-wide">{e.label}</p>
                </div>
                <p className="text-2xl font-bold mb-1">{e.number}</p>
                <p className="text-xs opacity-70">{e.sublabel}</p>
                <p className="text-xs opacity-60 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {e.available}
                </p>
              </a>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

          {/* Contact form */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Formulaire de contact</h2>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-800">Envoyez-nous un message</p>
                <p className="text-xs text-gray-400 mt-0.5">Réponse garantie sous 48 heures ouvrées</p>
              </div>
              <ContactForm />
            </div>

            {/* Notice */}
            <div className="mt-4 flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-800">Pour les urgences liées au bracelet</p>
                <p className="text-xs text-amber-700 mt-0.5">N&apos;utilisez pas ce formulaire. Appelez directement l&apos;infoline : <strong>+226 25 33 06 19</strong></p>
              </div>
            </div>
          </div>

          {/* Offices */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Bureaux & adresses</h2>
            <div className="space-y-4">
              {OFFICES.map((office) => (
                <div key={office.title} className={`bg-white rounded-2xl border p-5 ${office.primary ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-gray-100'}`}>
                  {office.primary && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <Shield className="w-3 h-3 text-emerald-600" />
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Bureau principal SIGEP</span>
                    </div>
                  )}
                  <h3 className="text-sm font-bold text-gray-900 mb-3">{office.title}</h3>
                  <ul className="space-y-2 text-xs text-gray-600">
                    <li className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <span>{office.address}<br />{office.city}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      {office.hours}
                    </li>
                    <li className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <a href={`tel:${office.phone.replace(/\s/g, '')}`} className="hover:text-gray-900 transition-colors">{office.phone}</a>
                    </li>
                    <li className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <a href={`mailto:${office.email}`} className="hover:text-gray-900 transition-colors">{office.email}</a>
                    </li>
                  </ul>
                </div>
              ))}
            </div>

            {/* External links */}
            <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Liens utiles</h3>
              <ul className="space-y-2">
                {[
                  { label: 'Ministère de la Justice — site officiel', href: 'https://www.justice.gov.bf' },
                  { label: 'Code Pénal burkinabè — texte intégral', href: 'https://www.justice.gov.bf' },
                  { label: 'Aide juridictionnelle — barème officiel', href: 'https://www.justice.gov.bf' },
                ].map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-emerald-700 hover:text-emerald-900 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
      <SiteFooter />
    </>
  );
}
