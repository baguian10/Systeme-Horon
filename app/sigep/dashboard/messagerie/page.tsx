import { redirect } from 'next/navigation';
import { Plus, Lock } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { fetchThreads, fetchMessagingRecipients, fetchUnreadMessagesInfo } from '@/lib/mock/helpers';
import NewThreadForm from './NewThreadForm';
import ThreadsList from './ThreadsList';

export const metadata = { title: 'Messagerie sécurisée — SIGEP' };
export const revalidate = 0;

export default async function MessageriePage() {
  const session = await getSession();
  if (!session) redirect('/sigep/dashboard');

  const [threads, recipients, unreadInfo] = await Promise.all([
    fetchThreads(session.id),
    fetchMessagingRecipients(session.id),
    fetchUnreadMessagesInfo(session.id).catch(() => ({ total: 0, byThread: {} })),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">Messagerie sécurisée</h2>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <Lock className="w-2.5 h-2.5" /> Canal sécurisé
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Communications internes SIGEP — agents, juges, administration
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Thread list — search, unread badges, closed-thread filter */}
        <div className="lg:col-span-2">
          <ThreadsList threads={threads} unreadByThread={unreadInfo.byThread} />
        </div>

        {/* New thread form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" />
              <h3 className="font-semibold text-gray-900 text-sm">Nouvelle conversation</h3>
            </div>
            <NewThreadForm currentUserId={session.id} recipients={recipients} />
          </div>

          {/* Security notice */}
          <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-800">Messagerie sécurisée</p>
            </div>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Communications chiffrées en transit (TLS) et au repos, accès contrôlé
              par session et journalisé dans l&apos;audit SIGEP. Les fils clôturés sont
              conservés en lecture seule et peuvent être produits comme preuve dans
              une procédure judiciaire.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
