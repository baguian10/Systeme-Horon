'use client';

import { useActionState, useRef, useEffect, useState } from 'react';
import { Send, CheckCheck, Archive } from 'lucide-react';
import { sendMessageAction } from '../actions';
import type { Message, UserRole } from '@/lib/supabase/types';

const ROLE_BADGE: Record<UserRole, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Admin',         color: 'bg-red-100 text-red-700' },
  ADMIN:       { label: 'Administrateur', color: 'bg-fuchsia-100 text-fuchsia-700' },
  JUDGE:       { label: 'Juge',          color: 'bg-blue-100 text-blue-700' },
  OPERATIONAL: { label: 'Agent terrain', color: 'bg-emerald-100 text-emerald-700' },
  STRATEGIC:   { label: 'Stratégique',   color: 'bg-purple-100 text-purple-700' },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { timeZone: 'Africa/Ouagadougou',
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

interface Props {
  threadId: string;
  messages: Message[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: UserRole;
  participantCount: number;
  initialClosed: boolean;
}

export default function ConversationView({ threadId, messages: initialMessages, currentUserId, participantCount, initialClosed }: Props) {
  const [state, formAction, isPending] = useActionState(sendMessageAction, null);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [closed, setClosed] = useState(initialClosed);
  const [pCount, setPCount] = useState(participantCount);
  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef   = useRef<HTMLFormElement>(null);
  const sinceRef  = useRef<string>(
    initialMessages.length ? initialMessages[initialMessages.length - 1].created_at : new Date(0).toISOString()
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Reset form after successful send
  useEffect(() => {
    if (!isPending && !state?.error) formRef.current?.reset();
  }, [isPending, state]);

  // Live conversation: poll the membership-gated feed every 10 s — new
  // messages, closed state and participant count arrive without a reload.
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await fetch(`/api/messages/feed?threadId=${encodeURIComponent(threadId)}&since=${encodeURIComponent(sinceRef.current)}`, { cache: 'no-store' });
        if (!res.ok || stopped) return;
        const d = await res.json() as { messages: Message[]; closed_at: string | null; participant_count: number };
        if (Array.isArray(d.messages) && d.messages.length > 0) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const fresh = d.messages.filter((m) => !seen.has(m.id));
            if (fresh.length === 0) return prev;
            sinceRef.current = fresh[fresh.length - 1].created_at;
            return [...prev, ...fresh];
          });
        }
        setClosed(!!d.closed_at);
        if (typeof d.participant_count === 'number') setPCount(d.participant_count);
      } catch { /* transient — next tick retries */ }
    };
    const id = setInterval(tick, 10_000);
    return () => { stopped = true; clearInterval(id); };
  }, [threadId]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col" style={{ minHeight: '500px' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4" style={{ maxHeight: '500px' }}>
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Aucun message</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId;
          const badge  = ROLE_BADGE[msg.sender_role] ?? ROLE_BADGE.OPERATIONAL;
          // Read receipt on own messages: readers other than the sender vs
          // the other participants.
          const readers = (msg.is_read_by ?? []).filter((id) => id !== msg.sender_id).length;
          const others = Math.max(1, pCount - 1);
          return (
            <div key={msg.id} className={`flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
              {/* Sender info */}
              <div className={`flex items-center gap-2 text-[10px] text-gray-400 ${isMine ? 'flex-row-reverse' : ''}`}>
                <span className={`font-bold px-1.5 py-0.5 rounded-full text-[9px] ${badge.color}`}>{badge.label}</span>
                <span className="font-medium text-gray-600">{isMine ? 'Vous' : msg.sender_name}</span>
                <span>{formatTime(msg.created_at)}</span>
              </div>
              {/* Bubble */}
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  isMine
                    ? 'bg-emerald-600 text-white rounded-tr-sm'
                    : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                }`}
              >
                {msg.content}
              </div>
              {isMine && (
                <span className={`flex items-center gap-0.5 text-[9px] ${readers >= others ? 'text-emerald-500' : 'text-gray-300'}`}>
                  <CheckCheck className="w-3 h-3" /> Vu par {Math.min(readers, others)}/{others}
                </span>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply form — or archive notice when the thread is closed */}
      {closed ? (
        <div className="border-t border-gray-100 px-5 py-4 flex items-center gap-2 text-sm text-slate-500 bg-slate-50">
          <Archive className="w-4 h-4" /> Fil clôturé — lecture seule.
        </div>
      ) : (
        <div className="border-t border-gray-100 px-5 py-4">
          {state?.error && <p className="text-xs text-red-600 mb-2">{state.error}</p>}
          <form ref={formRef} action={formAction} className="flex gap-3">
            <input type="hidden" name="thread_id" value={threadId} />
            <textarea
              name="content"
              required
              maxLength={5000}
              rows={2}
              placeholder="Votre message…"
              className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button
              type="submit"
              disabled={isPending}
              className="flex-shrink-0 w-10 h-10 self-end rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              title="Envoyer (Ctrl+Entrée)"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-[10px] text-gray-400 mt-1.5">
            Ctrl+Entrée pour envoyer · Canal sécurisé (chiffrement en transit et au repos, accès journalisé) · max 5000 caractères
          </p>
        </div>
      )}
    </div>
  );
}
