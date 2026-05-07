import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

const LINKS_PROGRAMME = [
  { href: '/',                   label: 'Accueil' },
  { href: '/initiative',         label: "L'Initiative Présidentielle" },
  { href: '/fonctionnement',     label: 'Fonctionnement du système' },
  { href: '/programme-tig',      label: 'Programme TIG' },
  { href: '/statistiques',       label: 'Statistiques & Bilan' },
];

const LINKS_INFO = [
  { href: '/guide-beneficiaire', label: 'Guide du bénéficiaire' },
  { href: '/actualites',         label: 'Actualités & Communiqués' },
  { href: '/faq',                label: 'Questions fréquentes' },
  { href: '/contact',            label: 'Contact & Infoline' },
];

export default function SiteFooter() {
  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="h-0.5 bg-gradient-to-r from-emerald-600 via-amber-500 to-red-600" />

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

          {/* Programme */}
          <div>
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">Le Programme</p>
            <ul className="space-y-2.5">
              {LINKS_PROGRAMME.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-xs text-gray-500 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Infos pratiques */}
          <div>
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-4">Informations pratiques</p>
            <ul className="space-y-2.5 mb-5">
              {LINKS_INFO.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-xs text-gray-500 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-gray-800 pt-4">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Infoline</p>
              <p className="text-sm font-semibold text-white">+226 25 33 06 19</p>
              <p className="text-[10px] text-gray-500">Lun–Ven · 07h30–17h30</p>
            </div>
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
