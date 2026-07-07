import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { allow, canManageTigSites } from '@/lib/auth/permissions';
import NewTigSiteForm from '@/components/tig/NewTigSiteForm';

export const metadata = { title: 'Nouveau site TIG — SIGEP' };

export default async function NewTigSitePage() {
  const session = await getSession();
  if (!session || !allow(session, canManageTigSites(session.role), 'tig')) {
    redirect('/sigep/dashboard/tig-sites');
  }
  return <NewTigSiteForm />;
}
