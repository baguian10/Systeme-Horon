'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, Lock, Menu, X } from 'lucide-react';

const NAV = [
  { href: '/',                   label: 'Accueil' },
  { href: '/initiative',         label: "L'Initiative" },
  { href: '/fonctionnement',     label: 'Fonctionnement' },
  { href: '/programme-tig',      label: 'Programme TIG' },
  { href: '/statistiques',       label: 'Statistiques' },
  { href: '/actualites',         label: 'Actualités' },
  { href: '/guide-beneficiaire', label: 'Guide' },
  { href: '/faq',                label: 'FAQ' },
  { href: '/contact',            label: 'Contact' },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 bg-white/98 backdrop-blur-sm transition-all duration-300 ${
        scrolled
          ? 'shadow-md border-b border-gray-200'
          : 'shadow-none border-b border-transparent'
      }`}
    >
      {/* BF tricolor accent */}
      <div className="h-0.5 bg-gradient-to-r from-bf-green via-bf-gold to-bf-red" />

      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-bf-green flex items-center justify-center shadow-sm group-hover:bg-bf-green-dark transition-colors">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="leading-none">
            <p className="text-sm font-bold text-gray-900 tracking-tight">Système Horon</p>
            <p className="text-[10px] text-bf-green font-semibold uppercase tracking-widest mt-0.5">Burkina Faso</p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          {NAV.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'text-bf-green bg-bf-green/8 font-semibold'
                    : 'text-gray-600 hover:text-bf-green hover:bg-gray-50'
                }`}
              >
                {label}
                {active && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-bf-green" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 flex-shrink-0">
          <Link
            href="/sigep"
            title="Accès réservé au personnel judiciaire autorisé"
            className="hidden md:flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-2 transition-all"
          >
            <Lock className="w-3.5 h-3.5" />
            Accès SIGEP
          </Link>

          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            <span className={`block transition-transform duration-200 ${open ? 'rotate-90' : 'rotate-0'}`}>
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile nav — smooth slide */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-white border-t border-gray-100 px-6 py-4 space-y-1">
          {NAV.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'text-bf-green bg-bf-green/8 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {label}
                {active && <span className="w-1.5 h-1.5 rounded-full bg-bf-green" />}
              </Link>
            );
          })}
          <div className="pt-2 border-t border-gray-100 mt-2">
            <Link
              href="/sigep"
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Lock className="w-3.5 h-3.5" /> Accès SIGEP
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
