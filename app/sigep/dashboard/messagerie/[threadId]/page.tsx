import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FolderOpen, Lock, Users, Archive } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { fetchThreads, fetchMessages, markThreadRead, fetchMessagingRecipients } from '@/lib/mock/helpers';
import ConversationView from './ConversationView';
import ThreadAdminPanel from './ThreadAdminPanel';

export const revalidate = 0;

export default async function ConversationPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const session = await getSession();
  if (!session) redirect('/sigep/dashboard');

  const [threads, messages, allRecipients] = await Promise.all([
    fetchThreads(session.id),
    fetchMessages(threadId),
    fetchMessagingRecipients(session.id),
  ]);

  const thread = threads.find((t) => t.id === threadId);
  if (!thread) notFound();

  // Opening the conversation marks everything as read (drives the badges).
  await markThreadRead(session.id, threadId).catch(() => {});

  const canManage = session.role === 'SUPER_ADMIN' || thread.created_by === session.id;
  const isClosed = !!thread.closed_at;

  // Resolve participant names from the recipients directory (+ self).
  const nameById = new Map(allRecipients.map((r) => [r.id, r.full_name]));
  nameById.set(session.id, session.full_name);
  const participants = thread.participant_ids.map((id) => ({
    id, full_name: nameById.get(id) ?? 'Compte supprimé',
  }));
  const addable = allRecipients.filter((r) => !thread.participant_ids.includes(r.id));
  const closedByName = thread.closed_by ? (nameById.get(thread.closed_by) ?? '—') : null;

  return (
    <div className="max-w-3xl space-y-4">
      {/* Back */}
      <Link
        href="/sigep/dashboard/messagerie"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Messagerie
      </Link>

      {/* Closed banner — legal archive state */}
      {isClosed && (
        <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700">
          <Archive className="w-4 h-4 flex-shrink-0" />
          Fil clôturé le {new Date(thread.closed_at!).toLocaleString('fr-FR', { timeZone: 'Africa/Ouagadougou', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          {closedByName ? ` par ${closedByName}` : ''} — lecture seule.
        </div>
      )}

      {/* Thread header */}
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">{thread.subject}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              {thread.case_number && thread.case_id && (
                <Link href={`/sigep/dashboard/cases/${thread.case_id}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                  <FolderOpen className="w-3 h-3" /> {thread.case_number}
                </Link>
              )}
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {participants.length} participant{participants.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
          {/* Honest security label — transport + at-rest encryption with audited
              access, NOT end-to-end (the previous claim was false). */}
          <span
            data-tip="Chiffrement en transit (TLS) et au repos, accès contrôlé et journalisé"
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 flex-shrink-0"
          >
            <Lock className="w-2.5 h-2.5" /> Canal sécurisé
          </span>
        </div>

        <ThreadAdminPanel
          threadId={threadId}
          participants={participants}
          addable={addable}
          createdBy={thread.created_by}
          canManage={canManage}
          isClosed={isClosed}
          isSuperAdmin={session.role === 'SUPER_ADMIN'}
        />
      </div>

      {/* Conversation */}
      <ConversationView
        threadId={threadId}
        messages={messages}
        currentUserId={session.id}
        currentUserName={session.full_name}
        currentUserRole={session.role}
        participantCount={participants.length}
        initialClosed={isClosed}
      />
    </div>
  );
}
