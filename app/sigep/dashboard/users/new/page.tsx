import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { canViewUsers } from '@/lib/auth/permissions';
import UserForm from '@/components/users/UserForm';

export const metadata = { title: 'Nouvel utilisateur — SIGEP' };

export default async function NewUserPage() {
  const session = await getSession();
  if (!session || !canViewUsers(session.role)) redirect('/sigep/dashboard');

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Créer un compte utilisateur</h2>
        <p className="text-sm text-gray-500 mt-0.5">Accès SUPER_ADMIN uniquement</p>
      </div>
      <UserForm />
    </div>
  );
}
