import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Plus, FolderOpen, Lock } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { fetchThreads } from '@/lib/mock/helpers';
import NewThreadForm from './NewThreadForm';

export const metadata = { title: 'Messagerie sécurisée — SIGEP' };
export const revalidate = 0;

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700',
  JUDGE:       'bg-blue-100 text-blue-700',
  OPERATIONAL: 'bg-emerald-100 text-emerald-700',
  STRATEGIC:   'bg-purple-100 text-purple-700',
};
const ROLE_INITIALS: Record<string, string> = {
  SUPER_ADMIN: 'SA', JUDGE: 'JG', OPERATIONAL: 'OP', STRATEGIC: 'ST',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}j`;
  if (h > 0) return `${h}h`;
  return `${Math.floor(diff / 60000)}min`;
}

export default async function MessageriePage() {
  const session = await getSession();
  if (!session) redirect('/sigep/dashboard');

  const threads = await fetchThreads(session.id);
  const unread = threads.filter((t) =>
    (t.last_message_preview && !t.participant_ids.includes(session.id))
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">Messagerie sécurisée</h2>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <Lock className="w-2.5 h-2.5" /> Chiffré
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Communications internes SIGEP — agents, juges, administration
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Thread list */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <h3 className="font-semibold text-gray-900 text-sm">Conversations ({threads.length})</h3>
              </div>
            </div>

            {threads.length === 0 ? (
              <div className="flex flex-col items-center py-14 gap-3 text-center">
                <MessageSquare className="w-10 h-10 text-gray-200" />
                <p className="text-sm text-gray-400">Aucune conversation</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <Link
                      href={`/sigep/dashboard/messagerie/${thread.id}`}
                      className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-500">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
                            {thread.subject}
                          </p>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                            {timeAgo(thread.last_message_at)}
                          </span>
                        </div>
                        {thread.case_number && (
                          <div className="flex items-center gap-1 mb-1">
                            <FolderOpen className="w-3 h-3 text-gray-400" />
                            <span className="text-[10px] font-mono text-gray-400">{thread.case_number}</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 truncate">{thread.last_message_preview}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* New thread form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" />
              <h3 className="font-semibold text-gray-900 text-sm">Nouvelle conversation</h3>
            </div>
            <NewThreadForm currentUserId={session.id} />
          </div>

          {/* Security notice */}
          <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-800">Messagerie sécurisée</p>
            </div>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Toutes les communications sont chiffrées de bout en bout et enregistrées
              dans le journal d&apos;audit SIGEP. Elles peuvent être produites comme
              preuve dans une procédure judiciaire.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
