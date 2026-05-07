import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { canViewUsers } from '@/lib/auth/permissions';
import UserForm from '@/components/users/UserForm';

export const metadata = { title: 'Nouvel utilisateur — SIGEP' };

export default async function NewUserPage() {
  const session = await getSession();
  if (!session || !canViewUsers(session.role)) redirect('/sigep/dashboard');

  const isJudge = session.role === 'JUDGE';

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          {isJudge ? 'Créer un agent opérationnel' : 'Créer un compte utilisateur'}
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {isJudge
            ? 'Juge — Délégation à un agent de terrain sous votre autorité'
            : 'Super Administrateur — Comptes judiciaires et stratégiques'}
        </p>
      </div>
      <UserForm creatorRole={session.role} />
    </div>
  );
}
