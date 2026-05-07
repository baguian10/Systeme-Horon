import type { UserRole } from '@/lib/supabase/types';

export const ROLE_LEVEL: Record<UserRole, number> = {
  SUPER_ADMIN: 0,
  STRATEGIC:   1,
  JUDGE:       2,
  OPERATIONAL: 3,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Administrateur',
  STRATEGIC:   'Stratégique',
  JUDGE:       'Juge',
  OPERATIONAL: 'Opérationnel',
};

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
export const canCreateCase        = (role: UserRole) => role === 'JUDGE';
export const canManageGeofences   = (role: UserRole) => role === 'JUDGE' || role === 'SUPER_ADMIN';
export const canManageAssignments = (role: UserRole) => role === 'JUDGE' || role === 'SUPER_ADMIN';
export const canUpdateCaseStatus  = (role: UserRole) => role === 'JUDGE' || role === 'SUPER_ADMIN';

// ── Level 3 (OPERATIONAL) — assigned cases only ──────────────────────────────
// Cases, alerts, map, real-time: anyone except STRATEGIC
export const canViewCases         = (role: UserRole) => role !== 'STRATEGIC';
export const canViewRealtime      = (role: UserRole) => role !== 'STRATEGIC';
export const canResolveAlert      = (role: UserRole) => role !== 'STRATEGIC';
export const canViewPII           = (role: UserRole) => role !== 'STRATEGIC';

// ── Devices: SUPER_ADMIN + JUDGE (OPERATIONAL sees tracking, not hardware) ───
export const canViewDevices       = (role: UserRole) => role === 'SUPER_ADMIN' || role === 'JUDGE';

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
