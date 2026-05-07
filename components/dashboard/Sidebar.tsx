'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FolderOpen, Bell, Map,
  BarChart2, Users, ShieldCheck, ChevronRight,
  Activity, ClipboardList, Watch, Hexagon,
  FileText, AlertTriangle, Shovel,
} from 'lucide-react';
import type { UserRole } from '@/lib/supabase/types';
import {
  canViewUsers, canViewStats, canViewDevices,
  canViewCases, canViewRealtime, canViewAudit,
  canManageGeofences, canViewReports, canViewViolations, canViewTigSites,
} from '@/lib/auth/permissions';

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ReactNode;
}

function buildNav(role: UserRole): NavItem[] {
  const items: NavItem[] = [
    { href: '/sigep/dashboard', label: "Vue d'ensemble", icon: <LayoutDashboard className="w-4 h-4" /> },
  ];

  // Cases, Alerts, Real-time tracking — blocked for STRATEGIC (no individual data)
  if (canViewCases(role)) {
    items.push({ href: '/sigep/dashboard/cases',      label: 'Dossiers',    icon: <FolderOpen className="w-4 h-4" /> });
    items.push({ href: '/sigep/dashboard/alerts',     label: 'Alertes',     icon: <Bell className="w-4 h-4" /> });
  }

  // Map visible to everyone (STRATEGIC sees national/aggregate view)
  items.push({ href: '/sigep/dashboard/map', label: 'Surveillance', icon: <Map className="w-4 h-4" /> });

  // Real-time monitoring — not for STRATEGIC
  if (canViewRealtime(role)) {
    items.push({ href: '/sigep/dashboard/monitoring', label: 'Temps réel', icon: <Activity className="w-4 h-4" /> });
  }

  // Geofences — JUDGE + SUPER_ADMIN
  if (canManageGeofences(role)) {
    items.push({ href: '/sigep/dashboard/geofences', label: 'Géofences', icon: <Hexagon className="w-4 h-4" /> });
  }

  // Statistics — SUPER_ADMIN + STRATEGIC
  if (canViewStats(role)) {
    items.push({ href: '/sigep/dashboard/stats', label: 'Statistiques', icon: <BarChart2 className="w-4 h-4" /> });
  }

  // Devices — SUPER_ADMIN + JUDGE
  if (canViewDevices(role)) {
    items.push({ href: '/sigep/dashboard/devices', label: 'Bracelets', icon: <Watch className="w-4 h-4" /> });
  }

  // User management — SUPER_ADMIN + JUDGE (JUDGE sees their agents)
  if (canViewUsers(role)) {
    items.push({ href: '/sigep/dashboard/users', label: 'Utilisateurs', icon: <Users className="w-4 h-4" /> });
  }

  // Reports — JUDGE + SUPER_ADMIN
  if (canViewReports(role)) {
    items.push({ href: '/sigep/dashboard/rapports',    label: 'Rapports',     icon: <FileText className="w-4 h-4" /> });
  }

  // Violations history — not STRATEGIC
  if (canViewViolations(role)) {
    items.push({ href: '/sigep/dashboard/infractions', label: 'Infractions',  icon: <AlertTriangle className="w-4 h-4" /> });
  }

  // TIG sites — not STRATEGIC
  if (canViewTigSites(role)) {
    items.push({ href: '/sigep/dashboard/tig-sites',   label: 'Sites TIG',    icon: <Shovel className="w-4 h-4" /> });
  }

  // Audit log — SUPER_ADMIN only
  if (canViewAudit(role)) {
    items.push({ href: '/sigep/dashboard/audit', label: "Journal d'audit", icon: <ClipboardList className="w-4 h-4" /> });
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

  const roleLabels: Record<UserRole, string> = {
    SUPER_ADMIN: 'Niveau 0 — Admin',
    STRATEGIC:   'Niveau 1 — Stratégique',
    JUDGE:       'Niveau 2 — Juge',
    OPERATIONAL: 'Niveau 3 — Opérationnel',
  };

  const roleDotColors: Record<UserRole, string> = {
    SUPER_ADMIN: 'bg-red-500',
    STRATEGIC:   'bg-purple-500',
    JUDGE:       'bg-blue-500',
    OPERATIONAL: 'bg-emerald-500',
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-gray-950 border-r border-gray-800 flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">SIGEP</p>
            <p className="text-[10px] text-gray-500 leading-tight">Système Horon</p>
          </div>
        </div>
        {/* Role indicator */}
        <div className="mt-3 flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${roleDotColors[role]}`} />
          <span className="text-[10px] text-gray-500 truncate">{roleLabels[role]}</span>
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
                  ? 'bg-emerald-600/20 text-emerald-400'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className={active ? 'text-emerald-400' : 'text-gray-500 group-hover:text-gray-300'}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="w-3 h-3 text-emerald-400" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800">
        <p className="text-[10px] text-gray-600 uppercase tracking-wider">Burkina Faso</p>
        <p className="text-[10px] text-gray-700">Ministère de la Justice et des Droits Humains</p>
      </div>
    </aside>
  );
}
