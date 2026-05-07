'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Lock, Menu, X } from 'lucide-react';

const NAV = [
  { href: '/',               label: 'Accueil' },
  { href: '/initiative',     label: "L'Initiative" },
  { href: '/fonctionnement', label: 'Fonctionnement' },
  { href: '/programme-tig',  label: 'Programme TIG' },
  { href: '/statistiques',   label: 'Statistiques' },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/98 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      {/* BF tricolor accent */}
      <div className="h-0.5 bg-gradient-to-r from-bf-green via-bf-gold to-bf-red" />

      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-bf-green flex items-center justify-center shadow-sm group-hover:bg-bf-green-dark transition-colors">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="leading-none">
            <p className="text-sm font-bold text-gray-900 tracking-tight">Système Horon</p>
            <p className="text-[10px] text-bf-green font-semibold uppercase tracking-widest mt-0.5">Burkina Faso</p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'text-bf-green bg-bf-green/8 font-semibold'
                    : 'text-gray-600 hover:text-bf-green hover:bg-gray-50'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/sigep"
            title="Accès réservé au personnel judiciaire autorisé"
            className="hidden md:flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-2 transition-all"
          >
            <Lock className="w-3.5 h-3.5" />
            Accès SIGEP
          </Link>

          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-50"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`block px-3 py-2.5 rounded-lg text-sm font-medium ${
                pathname === href ? 'text-bf-green bg-bf-green/8' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="pt-2 border-t border-gray-100 mt-2">
            <Link
              href="/sigep"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-500"
            >
              <Lock className="w-3.5 h-3.5" /> Accès SIGEP
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
