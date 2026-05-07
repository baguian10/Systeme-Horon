import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { canViewUsers, canManageAllUsers } from '@/lib/auth/permissions';
import { fetchUsers } from '@/lib/mock/helpers';
import RoleBadge from '@/components/ui/RoleBadge';
import { CheckCircle, XCircle, UserPlus, ShieldAlert, Users, ShieldCheck } from 'lucide-react';
import ToggleUserButton from '@/components/users/ToggleUserButton';
import ForceResetButton from '@/components/users/ForceResetButton';

export const metadata = { title: 'Gestion des utilisateurs — SIGEP' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function ScopeBadge({ scope }: { scope?: string | null }) {
  if (!scope) return <span className="text-gray-300 text-xs">—</span>;
  return scope === 'FULL'
    ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full"><ShieldCheck className="w-3 h-3" />Complet</span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full"><Users className="w-3 h-3" />Restreint</span>;
}

export default async function UsersPage() {
  const session = await getSession();
  if (!session || !canViewUsers(session.role)) redirect('/sigep/dashboard');

  const isSuperAdmin = canManageAllUsers(session.role);
  const isJudge = session.role === 'JUDGE';

  const users = await fetchUsers(session.role, session.id);

  // ── JUDGE VIEW ────────────────────────────────────────────────────────────
  if (isJudge) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Mes agents de terrain</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {users.length} agent{users.length !== 1 ? 's' : ''} sous votre supervision directe
            </p>
          </div>
          <Link
            href="/sigep/dashboard/users/new"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            Créer un agent
          </Link>
        </div>

        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <ShieldAlert className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            <strong>Délégation judiciaire.</strong> Vous pouvez créer des comptes agents opérationnels (police, agents de terrain) placés sous votre autorité. Définissez leur portée d&apos;accès lors de la création. Ces agents peuvent résoudre des alertes et suivre les dossiers selon leur portée assignée.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Aucun agent sous votre supervision</p>
                <p className="text-xs text-gray-400 mt-1">Créez un premier compte agent opérationnel pour déléguer le suivi de terrain.</p>
              </div>
              <Link
                href="/sigep/dashboard/users/new"
                className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors"
              >
                <UserPlus className="w-4 h-4" /> Créer un agent
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Badge</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Affectation</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Portée</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Créé le</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-gray-900">{user.full_name}</p>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-500">
                        {user.badge_number ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500 max-w-xs truncate">
                        {user.jurisdiction ?? '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <ScopeBadge scope={user.access_scope} />
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        {user.is_active
                          ? <CheckCircle className="w-4 h-4 text-green-500" />
                          : <XCircle className="w-4 h-4 text-gray-300" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── SUPER_ADMIN VIEW ──────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

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

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 leading-relaxed">
          <strong>Système à accès fermé.</strong> Aucune création de compte autonome possible. Les comptes Juge et Stratégique sont créés par le Super Administrateur. Les juges peuvent créer des agents opérationnels sous leur supervision. Toutes les actions sont journalisées dans le registre d&apos;audit.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rôle</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Badge</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Juridiction</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Portée</th>
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
                  <td className="px-5 py-3.5">
                    <ScopeBadge scope={user.access_scope} />
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
