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

export const canViewUsers = (role: UserRole) => role === 'SUPER_ADMIN';
export const canViewStats = (role: UserRole) => role === 'SUPER_ADMIN' || role === 'STRATEGIC';
export const canCreateCase = (role: UserRole) => role === 'JUDGE' || role === 'SUPER_ADMIN';
export const canManageGeofences = (role: UserRole) => role === 'JUDGE' || role === 'SUPER_ADMIN';
export const canResolveAlert = (role: UserRole) => role !== 'STRATEGIC';
export const canViewPII = (role: UserRole) => role !== 'STRATEGIC';
export const canUpdateCaseStatus = (role: UserRole) => role === 'JUDGE' || role === 'SUPER_ADMIN';
