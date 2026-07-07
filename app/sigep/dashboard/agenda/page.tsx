import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { canViewAgenda, canManageAgenda, allow } from '@/lib/auth/permissions';
import { fetchAgenda, fetchActiveCasesForSelect } from '@/lib/mock/helpers';
import AgendaClient from '@/components/agenda/AgendaClient';

export const metadata = { title: 'Agenda des obligations — SIGEP' };
export const revalidate = 0;

export default async function AgendaPage() {
  const session = await getSession();
  if (!session || !allow(session, canViewAgenda(session.role), 'cases.viewAll')) {
    redirect('/sigep/dashboard');
  }

  const canManage = allow(session, canManageAgenda(session.role), 'agenda');

  const [obligations, cases] = await Promise.all([
    fetchAgenda(session.role, session.id),
    canManage ? fetchActiveCasesForSelect(session.role) : Promise.resolve([]),
  ]);

  return (
    <AgendaClient
      obligations={obligations}
      canManage={canManage}
      cases={cases}
    />
  );
}
