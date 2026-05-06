import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

const LINKS = [
  { href: '/',               label: 'Accueil' },
  { href: '/initiative',    label: "L'Initiative Présidentielle" },
  { href: '/fonctionnement', label: 'Fonctionnement du système' },
];

export default function SiteFooter() {
  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="h-1 bg-gradient-to-r from-bf-green via-bf-gold to-bf-red" />

      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-bf-green flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-white text-sm">Système Horon</span>
            </div>
            <p className="text-xs leading-relaxed text-gray-500 mb-4">
              Programme national de surveillance électronique placé sous l'autorité du Ministère de la Justice et des Droits Humains du Burkina Faso.
            </p>
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-medium">
              République du Burkina Faso
            </p>
            <p className="text-[10px] text-gray-700 mt-0.5">Unité — Progrès — Justice</p>
          </div>

          {/* Navigation */}
          <div>
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">Navigation</p>
            <ul className="space-y-2.5">
              {LINKS.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-xs text-gray-500 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">Avis légal</p>
            <p className="text-xs text-gray-500 leading-relaxed mb-3">
              Ce site est à usage institutionnel exclusif. Les données relatives au programme sont soumises au secret judiciaire et à la législation sur la protection des données personnelles.
            </p>
            <p className="text-xs text-gray-600">
              Toute divulgation non autorisée est passible de poursuites judiciaires conformément au Code Pénal burkinabè.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <span>© {new Date().getFullYear()} Ministère de la Justice et des Droits Humains — Burkina Faso</span>
          <span>Tous droits réservés · Usage strictement institutionnel</span>
        </div>
      </div>
    </footer>
  );
}
