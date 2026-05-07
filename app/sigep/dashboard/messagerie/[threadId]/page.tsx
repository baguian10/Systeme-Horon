import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FolderOpen, Lock, Users } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { fetchThreads, fetchMessages } from '@/lib/mock/helpers';
import ConversationView from './ConversationView';

export const revalidate = 0;

export default async function ConversationPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const session = await getSession();
  if (!session) redirect('/sigep/dashboard');

  const [threads, messages] = await Promise.all([
    fetchThreads(session.id),
    fetchMessages(threadId),
  ]);

  const thread = threads.find((t) => t.id === threadId);
  if (!thread) notFound();

  return (
    <div className="max-w-3xl space-y-4">
      {/* Back */}
      <Link
        href="/sigep/dashboard/messagerie"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Messagerie
      </Link>

      {/* Thread header */}
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">{thread.subject}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              {thread.case_number && (
                <span className="flex items-center gap-1">
                  <FolderOpen className="w-3 h-3" /> {thread.case_number}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {thread.participant_ids.length} participant{thread.participant_ids.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 flex-shrink-0">
            <Lock className="w-2.5 h-2.5" /> Chiffré
          </span>
        </div>
      </div>

      {/* Conversation */}
      <ConversationView
        threadId={threadId}
        messages={messages}
        currentUserId={session.id}
        currentUserName={session.full_name}
        currentUserRole={session.role}
      />
    </div>
  );
}
