import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { canViewUsers } from '@/lib/auth/permissions';
import { fetchUsers } from '@/lib/mock/helpers';
import RoleBadge from '@/components/ui/RoleBadge';
import { CheckCircle, XCircle, UserPlus } from 'lucide-react';
import ToggleUserButton from '@/components/users/ToggleUserButton';

export const metadata = { title: 'Utilisateurs — SIGEP' };

export default async function UsersPage() {
  const session = await getSession();
  if (!session || !canViewUsers(session.role)) redirect('/sigep/dashboard');

  const users = await fetchUsers();

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Gestion des utilisateurs</h2>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} compte{users.length !== 1 ? 's' : ''} enregistré{users.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/sigep/dashboard/users/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Nouveau utilisateur
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rôle</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Badge</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Juridiction</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Créé le</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actif</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{user.full_name}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-500">
                    {user.badge_number ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-500 max-w-xs truncate">
                    {user.jurisdiction ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-400">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-5 py-3.5">
                    {user.is_active
                      ? <CheckCircle className="w-4 h-4 text-green-500" />
                      : <XCircle className="w-4 h-4 text-gray-300" />}
                  </td>
                  <td className="px-5 py-3.5">
                    {user.id !== session.id && (
                      <ToggleUserButton
                        userId={user.id}
                        isActive={user.is_active}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
