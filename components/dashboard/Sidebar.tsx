'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FolderOpen, Bell, Map, BarChart2,
  Users, ShieldCheck, ChevronRight,
} from 'lucide-react';
import type { UserRole } from '@/lib/supabase/types';
import { canViewUsers, canViewStats } from '@/lib/auth/permissions';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function buildNav(role: UserRole): NavItem[] {
  const items: NavItem[] = [
    { href: '/sigep/dashboard', label: 'Vue d\'ensemble', icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: '/sigep/dashboard/cases', label: 'Dossiers', icon: <FolderOpen className="w-4 h-4" /> },
    { href: '/sigep/dashboard/alerts', label: 'Alertes', icon: <Bell className="w-4 h-4" /> },
    { href: '/sigep/dashboard/map', label: 'Surveillance', icon: <Map className="w-4 h-4" /> },
  ];
  if (canViewStats(role)) {
    items.push({ href: '/sigep/dashboard/stats', label: 'Statistiques', icon: <BarChart2 className="w-4 h-4" /> });
  }
  if (canViewUsers(role)) {
    items.push({ href: '/sigep/dashboard/users', label: 'Utilisateurs', icon: <Users className="w-4 h-4" /> });
  }
  return items;
}

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const nav = buildNav(role);

  function isActive(href: string) {
    if (href === '/sigep/dashboard') return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-gray-950 border-r border-gray-800 flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">SIGEP</p>
            <p className="text-[10px] text-gray-500 leading-tight">Système Horon</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
                active
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className={active ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 text-blue-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800">
        <p className="text-[10px] text-gray-600 uppercase tracking-wider">
          République du Mali
        </p>
        <p className="text-[10px] text-gray-700">Ministère de la Justice</p>
      </div>
    </aside>
  );
}
