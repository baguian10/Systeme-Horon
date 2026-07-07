'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import DeptAssignSelect from './DeptAssignSelect';
import type { User } from '@/lib/supabase/types';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  STRATEGIC: 'Stratégique',
  JUDGE: 'Juge',
  OPERATIONAL: 'Opérationnel',
};

interface Props {
  users: User[];
  depts: { id: string; name: string }[];
}

export default function OrgUserTable({ users, depts }: Props) {
  const [q, setQ] = useState('');

  const filtered = q.trim()
    ? users.filter(
        (u) =>
          u.full_name.toLowerCase().includes(q.toLowerCase()) ||
          u.role.toLowerCase().includes(q.toLowerCase()),
      )
    : users;

  return (
    <>
      <div className="px-5 py-3 border-b border-gray-50">
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un agent…"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Agent</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Rôle</th>
            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Entité</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {filtered.map((u) => (
            <tr key={u.id} className="hover:bg-gray-50/50">
              <td className="px-5 py-3 text-gray-900">{u.full_name}</td>
              <td className="px-5 py-3 text-gray-500 text-xs">{ROLE_LABEL[u.role] ?? u.role}</td>
              <td className="px-5 py-3">
                <DeptAssignSelect userId={u.id} value={u.department_id ?? null} depts={depts} />
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={3} className="px-5 py-8 text-center text-sm text-gray-400">
                Aucun résultat pour « {q} »
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="px-5 py-2 border-t border-gray-50">
        <p className="text-[11px] text-gray-400">
          {filtered.length} agent{filtered.length !== 1 ? 's' : ''}{q ? ` sur ${users.length}` : ''}
        </p>
      </div>
    </>
  );
}
