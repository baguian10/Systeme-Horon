'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, FolderOpen, Bell, Map,
  BarChart2, Users, ShieldCheck, ChevronRight,
  Activity, ClipboardList, Watch, Hexagon,
  FileText, AlertTriangle, Shovel, Calendar,
  XOctagon, Wrench, BellRing, Settings,
  MessageSquare, Smartphone, Building2, Inbox,
} from 'lucide-react';
import type { UserRole } from '@/lib/supabase/types';
import {
  canViewUsers, canViewStats, canViewDevices,
  canViewCases, canViewRealtime, canViewAudit,
  canManageGeofences, canViewReports, canViewViolations, canViewTigSites,
  canViewRevocations, canViewMaintenance, canViewAgenda, canViewParametres,
  canViewCaseRequests,
  allow,
} from '@/lib/auth/permissions';

interface NavItem {
  href:  string;
  label: string;
  icon:  React.ReactNode;
  badge?: number;
}

type Sess = { role: UserRole; permissions?: string[]; openAlertCount?: number; unreadMessagesCount?: number };

function buildNav(session: Sess): NavItem[] {
  const role = session.role;
  const items: NavItem[] = [
    { href: '/sigep/dashboard', label: "Vue d'ensemble", icon: <LayoutDashboard className="w-4 h-4" /> },
  ];

  if (allow(session, canViewCases(role), 'cases.viewAll')) {
    items.push({ href: '/sigep/dashboard/cases',  label: 'Dossiers', icon: <FolderOpen className="w-4 h-4" /> });
  }
  if (allow(session, canViewCases(role), 'alerts')) {
    items.push({ href: '/sigep/dashboard/alerts', label: 'Alertes', icon: <Bell className="w-4 h-4" />, badge: session.openAlertCount });
  }

  if (allow(session, canViewRealtime(role), 'alerts')) {
    items.push({ href: '/sigep/dashboard/map', label: 'Surveillance', icon: <Map className="w-4 h-4" /> });
  }

  if (allow(session, canViewRealtime(role), 'alerts')) {
    items.push({ href: '/sigep/dashboard/monitoring', label: 'Temps réel', icon: <Activity className="w-4 h-4" /> });
  }
  if (allow(session, canManageGeofences(role), 'geofences')) {
    items.push({ href: '/sigep/dashboard/geofences', label: 'Géofences', icon: <Hexagon className="w-4 h-4" /> });
  }
  if (allow(session, canViewStats(role), 'stats')) {
    items.push({ href: '/sigep/dashboard/stats', label: 'Statistiques', icon: <BarChart2 className="w-4 h-4" /> });
  }
  if (allow(session, canViewDevices(role), 'hardware')) {
    items.push({ href: '/sigep/dashboard/devices', label: 'Bracelets', icon: <Watch className="w-4 h-4" /> });
  }
  if (allow(session, canViewUsers(role), 'users.manage')) {
    items.push({ href: '/sigep/dashboard/users', label: 'Utilisateurs', icon: <Users className="w-4 h-4" /> });
  }
  if (allow(session, role === 'SUPER_ADMIN', 'users.manage')) {
    items.push({ href: '/sigep/dashboard/organisation', label: 'Organisation', icon: <Building2 className="w-4 h-4" /> });
  }
  if (allow(session, canViewReports(role), 'reports')) {
    items.push({ href: '/sigep/dashboard/rapports', label: 'Rapports', icon: <FileText className="w-4 h-4" /> });
  }
  if (allow(session, canViewViolations(role), 'reports')) {
    items.push({ href: '/sigep/dashboard/infractions', label: 'Infractions', icon: <AlertTriangle className="w-4 h-4" /> });
  }
  if (allow(session, canViewTigSites(role), 'tig')) {
    items.push({ href: '/sigep/dashboard/tig-sites', label: 'Sites TIG', icon: <Shovel className="w-4 h-4" /> });
  }
  if (allow(session, canViewAgenda(role), 'cases.viewAll')) {
    items.push({ href: '/sigep/dashboard/agenda', label: 'Agenda', icon: <Calendar className="w-4 h-4" /> });
  }
  if (allow(session, canViewRevocations(role), 'revocations')) {
    items.push({ href: '/sigep/dashboard/revocations', label: 'Révocations', icon: <XOctagon className="w-4 h-4" /> });
  }
  if (canViewCaseRequests(role)) {
    items.push({ href: '/sigep/dashboard/requetes', label: 'Requêtes', icon: <Inbox className="w-4 h-4" /> });
  }
  if (allow(session, canViewCases(role), 'cases.viewAll')) {
    items.push({ href: '/sigep/dashboard/messagerie', label: 'Messagerie', icon: <MessageSquare className="w-4 h-4" />, badge: session.unreadMessagesCount });
  }
  items.push({ href: '/sigep/dashboard/notifications', label: 'Notifications', icon: <BellRing className="w-4 h-4" /> });
  if (allow(session, canViewCases(role), 'cases.viewAll')) {
    items.push({ href: '/sigep/dashboard/terrain', label: 'Mode terrain', icon: <Smartphone className="w-4 h-4" /> });
  }
  if (allow(session, canViewMaintenance(role), 'maintenance')) {
    items.push({ href: '/sigep/dashboard/maintenance', label: 'Maintenance', icon: <Wrench className="w-4 h-4" /> });
  }
  if (allow(session, canViewAudit(role), 'audit')) {
    items.push({ href: '/sigep/dashboard/audit', label: "Journal d'audit", icon: <ClipboardList className="w-4 h-4" /> });
  }
  if (canViewParametres(role)) {
    items.push({ href: '/sigep/dashboard/parametres', label: 'Paramètres', icon: <Settings className="w-4 h-4" /> });
  }

  return items;
}

const NAV_TIPS: Record<string, string> = {
  '/sigep/dashboard': "Vue d'ensemble : indicateurs clés et activité récente",
  '/sigep/dashboard/cases': 'Dossiers de mesures sous surveillance électronique',
  '/sigep/dashboard/alerts': 'Alertes en temps réel : traiter, assigner, clôturer',
  '/sigep/dashboard/map': 'Carte de surveillance temps réel de tous les bracelets',
  '/sigep/dashboard/monitoring': 'Grille temps réel multi-bracelets',
  '/sigep/dashboard/geofences': 'Zones autorisées/interdites et couvre-feu',
  '/sigep/dashboard/stats': 'Statistiques et tableaux de bord agrégés',
  '/sigep/dashboard/devices': 'Parc de bracelets : SIM, étiquettes, journal, assignation',
  '/sigep/dashboard/users': 'Comptes utilisateurs et permissions',
  '/sigep/dashboard/organisation': 'Hiérarchie des juridictions et affectation des agents',
  '/sigep/dashboard/rapports': 'Rapports institutionnels',
  '/sigep/dashboard/infractions': 'Historique des infractions/violations',
  '/sigep/dashboard/tig-sites': "Catalogue des sites de travail d'intérêt général",
  '/sigep/dashboard/agenda': 'Agenda des échéances et rendez-vous',
  '/sigep/dashboard/revocations': 'Procédures de révocation de mesure',
  '/sigep/dashboard/requetes': 'Requêtes institutionnelles : suppression, archivage, réactivation, transfert',
  '/sigep/dashboard/messagerie': 'Messagerie interne entre agents',
  '/sigep/dashboard/notifications': 'Préférences de notification (push/SMS/email)',
  '/sigep/dashboard/terrain': 'Mode terrain pour agents en déplacement',
  '/sigep/dashboard/maintenance': 'Supervision technique de la plateforme',
  '/sigep/dashboard/audit': "Journal d'audit : qui a fait quoi",
  '/sigep/dashboard/parametres': 'Paramètres institutionnels et rétention',
};

const navContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
};

const navItem = {
  hidden:  { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
};

export default function Sidebar({ role, permissions, openAlertCount, unreadMessagesCount }: { role: UserRole; permissions?: string[]; openAlertCount?: number; unreadMessagesCount?: number }) {
  const pathname = usePathname();
  const nav = buildNav({ role, permissions, openAlertCount, unreadMessagesCount });

  function isActive(href: string) {
    if (href === '/sigep/dashboard') return pathname === href;
    return pathname.startsWith(href);
  }

  const roleLabels: Record<UserRole, string> = {
    SUPER_ADMIN: 'Niveau 0 — Admin',
    ADMIN:       'Administrateur délégué',
    STRATEGIC:   'Niveau 1 — Stratégique',
    JUDGE:       'Niveau 2 — Juge',
    OPERATIONAL: 'Niveau 3 — Opérationnel',
  };

  const roleDotColors: Record<UserRole, string> = {
    SUPER_ADMIN: 'bg-red-500',
    ADMIN:       'bg-fuchsia-500',
    STRATEGIC:   'bg-purple-500',
    JUDGE:       'bg-blue-500',
    OPERATIONAL: 'bg-emerald-500',
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-gray-950/95 backdrop-blur-xl border-r border-gray-700/40 flex flex-col z-40 shadow-2xl shadow-black/30">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="px-5 py-5 border-b border-gray-800/60"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-900/50">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">SIGEP</p>
            <p className="text-[10px] text-gray-500 leading-tight">Système Horon</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${roleDotColors[role]}`} />
          <span className="text-[10px] text-gray-500 truncate">{roleLabels[role]}</span>
        </div>
      </motion.div>

      {/* Nav */}
      <motion.nav
        variants={navContainer}
        initial="hidden"
        animate="visible"
        className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto"
      >
        {nav.map((item) => {
          const active = isActive(item.href);
          return (
            <motion.div
              key={item.href}
              variants={navItem}
              whileHover={{ x: 3, transition: { duration: 0.12 } }}
            >
              <Link
                href={item.href}
                data-tip={NAV_TIPS[item.href]}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
                  active
                    ? 'bg-emerald-600/20 text-emerald-400 shadow-sm shadow-emerald-900/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/70'
                }`}
              >
                <span className={active ? 'text-emerald-400' : 'text-gray-500 group-hover:text-gray-300'}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full leading-none">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
                {active && (
                  <motion.span
                    layoutId="activeIndicator"
                    className="w-3 h-3 text-emerald-400"
                    initial={false}
                  >
                    <ChevronRight className="w-3 h-3" />
                  </motion.span>
                )}
              </Link>
            </motion.div>
          );
        })}
      </motion.nav>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="px-5 py-4 border-t border-gray-800/60"
      >
        <p className="text-[10px] text-gray-600 uppercase tracking-wider">Burkina Faso</p>
        <p className="text-[10px] text-gray-700">Ministère de la Justice et des Droits Humains</p>
      </motion.div>
    </aside>
  );
}
