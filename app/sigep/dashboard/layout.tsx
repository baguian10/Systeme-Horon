import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { fetchOpenAlertCount, fetchUnreadMessagesInfo } from '@/lib/mock/helpers';
import { SessionProvider } from './context';
import Sidebar from '@/components/dashboard/Sidebar';
import Topbar from '@/components/dashboard/Topbar';
import AlertToastProvider from '@/components/realtime/AlertToastProvider';
import TooltipLayer from '@/components/ui/TooltipLayer';

export const metadata = { title: 'SIGEP — Tableau de bord', robots: 'noindex, nofollow' };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/sigep/login');

  const [openAlertCount, unreadInfo] = await Promise.all([
    fetchOpenAlertCount(session.role).catch(() => 0),
    fetchUnreadMessagesInfo(session.id).catch(() => ({ total: 0, byThread: {} })),
  ]);

  return (
    <SessionProvider user={session}>
      <AlertToastProvider>
        <div className="min-h-screen bg-gray-50 flex">
          <Sidebar role={session.role} permissions={session.permissions} openAlertCount={openAlertCount} unreadMessagesCount={unreadInfo.total} />
          <div className="flex-1 ml-60 flex flex-col min-h-screen">
            <Topbar title="SIGEP" />
            <main className="flex-1 p-6 overflow-auto">{children}</main>
          </div>
          <TooltipLayer />
        </div>
      </AlertToastProvider>
    </SessionProvider>
  );
}
