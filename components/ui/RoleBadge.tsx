import type { UserRole } from '@/lib/supabase/types';

const CONFIG: Record<UserRole, { label: string; className: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', className: 'bg-purple-100 text-purple-700' },
  STRATEGIC:   { label: 'Stratégique', className: 'bg-blue-100 text-blue-700' },
  JUDGE:       { label: 'Juge',         className: 'bg-emerald-100 text-emerald-700' },
  OPERATIONAL: { label: 'Opérationnel', className: 'bg-orange-100 text-orange-700' },
};

export default function RoleBadge({ role }: { role: UserRole }) {
  const { label, className } = CONFIG[role];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
