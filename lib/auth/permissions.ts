import type { UserRole } from '@/lib/supabase/types';

export const ROLE_LEVEL: Record<UserRole, number> = {
  SUPER_ADMIN: 0,
  ADMIN:       1,
  STRATEGIC:   1,
  JUDGE:       2,
  OPERATIONAL: 3,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Administrateur',
  ADMIN:       'Administrateur',
  STRATEGIC:   'Stratégique',
  JUDGE:       'Juge',
  OPERATIONAL: 'Opérationnel',
};

// ── Granular permission catalog (for ADMIN accounts) ─────────────────────────
export const PERMISSIONS = {
  'cases.viewAll':   'Voir tous les dossiers',
  'cases.create':    'Créer des dossiers',
  'penalties':       'Définir les peines',
  'geofences':       'Géofences (tracé)',
  'hardware':        'Bracelets / hardware / SIM',
  'beacons':         'Balises BLE',
  'commands':        'Commandes tracker',
  'commands.shutdown': 'Éteindre un bracelet',
  'alerts':          'Alertes',
  'reports':         'Rapports',
  'stats':           'Statistiques',
  'users.manage':    'Gérer les utilisateurs',
  'audit':           'Journal d’audit',
  'tig':             'Sites TIG',
  'revocations':     'Révocations',
  'maintenance':     'Maintenance',
} as const;

export type Permission = keyof typeof PERMISSIONS;

interface PermSession { role: UserRole; permissions?: string[] }

// Unified permission check. SUPER_ADMIN = all; ADMIN = only checked permissions;
// other roles keep their fixed role defaults.
export function can(session: PermSession | null | undefined, key: Permission): boolean {
  if (!session) return false;
  if (session.role === 'SUPER_ADMIN') return true;
  if (session.role === 'ADMIN') return (session.permissions ?? []).includes(key);
  return roleDefault(session.role, key);
}

function roleDefault(role: UserRole, key: Permission): boolean {
  switch (key) {
    case 'cases.viewAll':   return false;
    case 'cases.create':    return role === 'JUDGE';
    case 'penalties':       return role === 'JUDGE';
    case 'geofences':       return false;            // technical → admin only
    case 'hardware':        return false;
    case 'beacons':         return false;
    case 'commands':        return false;
    case 'commands.shutdown': return false;
    case 'alerts':          return role !== 'STRATEGIC';
    case 'reports':         return role === 'JUDGE';
    case 'stats':           return role === 'STRATEGIC';
    case 'users.manage':    return false;
    case 'audit':           return false;
    case 'tig':             return role !== 'STRATEGIC';
    case 'revocations':     return role !== 'STRATEGIC';
    case 'maintenance':     return role === 'JUDGE';
    default:                return false;
  }
}

// ── Level 0 (SUPER_ADMIN) ────────────────────────────────────────────────────
export const canConfigureHardware = (role: UserRole) => role === 'SUPER_ADMIN';
export const canManageAllUsers    = (role: UserRole) => role === 'SUPER_ADMIN';
export const canViewAudit         = (role: UserRole) => role === 'SUPER_ADMIN';
export const canExportData        = (role: UserRole) => role === 'SUPER_ADMIN' || role === 'STRATEGIC';

// ── Level 1 (STRATEGIC) — aggregate only, no individual tracking ─────────────
export const canViewStats         = (role: UserRole) => role === 'SUPER_ADMIN' || role === 'STRATEGIC';

// ── Level 2 (JUDGE) — case creation & agent management ──────────────────────
// SUPER_ADMIN + JUDGE can view users; JUDGE sees only their own agents
export const canViewUsers         = (role: UserRole) => role === 'SUPER_ADMIN' || role === 'JUDGE';
export const canCreateCase        = (role: UserRole) => role === 'JUDGE' || role === 'SUPER_ADMIN';
// Geofence tracing = technical task → SUPER_ADMIN only (judges aren't technical).
export const canManageGeofences   = (role: UserRole) => role === 'SUPER_ADMIN';
export const canManageAssignments = (role: UserRole) => role === 'JUDGE' || role === 'SUPER_ADMIN';
export const canUpdateCaseStatus  = (role: UserRole) => role === 'JUDGE' || role === 'SUPER_ADMIN';

// ── Level 3 (OPERATIONAL) — assigned cases only ──────────────────────────────
// Cases, alerts, map, real-time: anyone except STRATEGIC
export const canViewCases         = (role: UserRole) => role !== 'STRATEGIC';
export const canViewRealtime      = (role: UserRole) => role !== 'STRATEGIC';
export const canResolveAlert      = (role: UserRole) => role !== 'STRATEGIC';
export const canViewPII           = (role: UserRole) => role !== 'STRATEGIC';

// ── Devices / hardware (bracelets, BLE, SIM) = technical → SUPER_ADMIN only ──
export const canViewDevices       = (role: UserRole) => role === 'SUPER_ADMIN';

// ── Reports: SUPER_ADMIN + JUDGE ─────────────────────────────────────────────
export const canViewReports       = (role: UserRole) => role === 'SUPER_ADMIN' || role === 'JUDGE';

// ── Violations history: everyone except STRATEGIC ────────────────────────────
export const canViewViolations    = (role: UserRole) => role !== 'STRATEGIC';

// ── TIG sites: everyone except STRATEGIC ─────────────────────────────────────
export const canViewTigSites      = (role: UserRole) => role !== 'STRATEGIC';
export const canManageTigSites    = (role: UserRole) => role === 'SUPER_ADMIN' || role === 'JUDGE';

// ── Revocations: all non-STRATEGIC ───────────────────────────────────────────
export const canViewRevocations   = (role: UserRole) => role !== 'STRATEGIC';
export const canManageRevocations = (role: UserRole) => role === 'SUPER_ADMIN' || role === 'JUDGE';

// ── Journal: all non-STRATEGIC ───────────────────────────────────────────────
export const canWriteJournal      = (role: UserRole) => role !== 'STRATEGIC';

// ── Maintenance: SUPER_ADMIN + JUDGE ─────────────────────────────────────────
export const canViewMaintenance   = (role: UserRole) => role === 'SUPER_ADMIN' || role === 'JUDGE';

// ── Agenda: all non-STRATEGIC ────────────────────────────────────────────────
export const canViewAgenda        = (role: UserRole) => role !== 'STRATEGIC';

// ── Notifications: everyone ──────────────────────────────────────────────────
export const canViewNotifications = (_role: UserRole) => true;

// ── System parameters: SUPER_ADMIN only ──────────────────────────────────────
export const canViewParametres    = (role: UserRole) => role === 'SUPER_ADMIN';
