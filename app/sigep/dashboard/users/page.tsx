import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { canViewUsers } from '@/lib/auth/permissions';
import { fetchUsers } from '@/lib/mock/helpers';
import RoleBadge from '@/components/ui/RoleBadge';
import { CheckCircle, XCircle, UserPlus, ShieldAlert } from 'lucide-react';
import ToggleUserButton from '@/components/users/ToggleUserButton';
import ForceResetButton from '@/components/users/ForceResetButton';

export const metadata = { title: 'Gestion des utilisateurs — SIGEP' };

export default async function UsersPage() {
  const session = await getSession();
  if (!session || !canViewUsers(session.role)) redirect('/sigep/dashboard');

  const isSuperAdmin = session.role === 'SUPER_ADMIN';
  const users = await fetchUsers();

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Gestion des utilisateurs</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {users.length} compte{users.length !== 1 ? 's' : ''} enregistré{users.length !== 1 ? 's' : ''}
            {' '}· Système à accès fermé — invitation uniquement
          </p>
        </div>
        {isSuperAdmin && (
          <Link
            href="/sigep/dashboard/users/new"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Créer un compte
          </Link>
        )}
      </div>

      {/* Closed-system notice */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 leading-relaxed">
          <strong>Système à accès fermé.</strong> Aucune création de compte autonome possible. Les comptes sont créés exclusivement par le Super Administrateur sur invitation. Toutes les actions sont journalisées dans le registre d&apos;audit.
        </p>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
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
                {isSuperAdmin && (
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div>
                      <p className="font-semibold text-gray-900">{user.full_name}</p>
                      {user.id === session.id && (
                        <p className="text-[10px] text-emerald-600 font-medium">Vous</p>
                      )}
                    </div>
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
                  {isSuperAdmin && (
                    <td className="px-5 py-3.5">
                      {user.id !== session.id && (
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <ToggleUserButton userId={user.id} isActive={user.is_active} />
                          <ForceResetButton userId={user.id} />
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
