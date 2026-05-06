import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { SessionProvider } from './context';
import Sidebar from '@/components/dashboard/Sidebar';
import Topbar from '@/components/dashboard/Topbar';
import AlertToastProvider from '@/components/realtime/AlertToastProvider';

export const metadata = { title: 'SIGEP — Tableau de bord', robots: 'noindex, nofollow' };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/sigep/login');

  return (
    <SessionProvider user={session}>
      <AlertToastProvider>
        <div className="min-h-screen bg-gray-50 flex">
          <Sidebar role={session.role} />
          <div className="flex-1 ml-60 flex flex-col min-h-screen">
            <Topbar title="SIGEP" />
            <main className="flex-1 p-6 overflow-auto">{children}</main>
          </div>
        </div>
      </AlertToastProvider>
    </SessionProvider>
  );
}
