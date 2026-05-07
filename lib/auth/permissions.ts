import type { UserRole } from '@/lib/supabase/types';

export const ROLE_LEVEL: Record<UserRole, number> = {
  SUPER_ADMIN: 0,
  STRATEGIC: 1,
  JUDGE: 2,
  OPERATIONAL: 3,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Administrateur',
  STRATEGIC: 'Stratégique',
  JUDGE: 'Juge',
  OPERATIONAL: 'Opérationnel',
};

// SUPER_ADMIN can view all users; JUDGE can view & manage their own OPERATIONAL agents
export const canViewUsers = (role: UserRole) => role === 'SUPER_ADMIN' || role === 'JUDGE';
export const canManageAllUsers = (role: UserRole) => role === 'SUPER_ADMIN';
export const canConfigureHardware = (role: UserRole) => role === 'SUPER_ADMIN';
export const canViewStats = (role: UserRole) => role === 'SUPER_ADMIN' || role === 'STRATEGIC';
export const canCreateCase = (role: UserRole) => role === 'JUDGE' || role === 'SUPER_ADMIN';
export const canManageGeofences = (role: UserRole) => role === 'JUDGE' || role === 'SUPER_ADMIN';
export const canResolveAlert = (role: UserRole) => role !== 'STRATEGIC';
export const canViewPII = (role: UserRole) => role !== 'STRATEGIC';
export const canUpdateCaseStatus = (role: UserRole) => role === 'JUDGE' || role === 'SUPER_ADMIN';
export const canManageAssignments = (role: UserRole) => role === 'JUDGE' || role === 'SUPER_ADMIN';
export const canExportData = (role: UserRole) => role === 'SUPER_ADMIN' || role === 'STRATEGIC';
export const canViewDevices = (role: UserRole) => role === 'SUPER_ADMIN' || role === 'JUDGE';
