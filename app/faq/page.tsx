import { metadata as meta } from './metadata';
import FaqAccordion from './FaqAccordion';
import { HelpCircle, Phone } from 'lucide-react';
import Link from 'next/link';

export const metadata = meta;

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-gray-50">

      {/* Header */}
      <section className="bg-white border-b border-gray-100 py-12 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full px-4 py-1.5 mb-4">
            <HelpCircle className="w-3.5 h-3.5" />
            Réponses officielles
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 leading-tight">Questions fréquentes</h1>
          <p className="text-gray-500 leading-relaxed">
            Les réponses aux questions les plus posées par les bénéficiaires, leurs familles et les professionnels du droit
            sur le programme TIG et le Système Horon.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <FaqAccordion />

        {/* CTA contact */}
        <div className="bg-gradient-to-r from-gray-900 to-emerald-950 rounded-3xl px-6 py-8 text-center text-white">
          <HelpCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold mb-2">Vous n&apos;avez pas trouvé votre réponse ?</h2>
          <p className="text-sm text-gray-300 mb-5">
            Notre équipe est disponible du lundi au vendredi pour répondre à vos questions spécifiques.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="tel:+22625330619"
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              <Phone className="w-4 h-4" />
              +226 25 33 06 19
            </a>
            <Link
              href="/contact"
              className="flex items-center gap-2 border border-white/20 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Formulaire de contact
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
