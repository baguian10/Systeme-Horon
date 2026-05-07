'use client';

import { useActionState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { sendMessageAction } from '../actions';
import type { Message, UserRole } from '@/lib/supabase/types';

const ROLE_BADGE: Record<UserRole, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Admin',         color: 'bg-red-100 text-red-700' },
  JUDGE:       { label: 'Juge',          color: 'bg-blue-100 text-blue-700' },
  OPERATIONAL: { label: 'Agent terrain', color: 'bg-emerald-100 text-emerald-700' },
  STRATEGIC:   { label: 'Stratégique',   color: 'bg-purple-100 text-purple-700' },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

interface Props {
  threadId: string;
  messages: Message[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: UserRole;
}

export default function ConversationView({ threadId, messages, currentUserId, currentUserName, currentUserRole }: Props) {
  const [state, formAction, isPending] = useActionState(sendMessageAction, null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const formRef   = useRef<HTMLFormElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset form after successful send
  useEffect(() => {
    if (!isPending && !state?.error) formRef.current?.reset();
  }, [isPending, state]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col" style={{ minHeight: '500px' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4" style={{ maxHeight: '500px' }}>
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Aucun message</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId;
          const badge  = ROLE_BADGE[msg.sender_role];
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
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply form */}
      <div className="border-t border-gray-100 px-5 py-4">
        {state?.error && <p className="text-xs text-red-600 mb-2">{state.error}</p>}
        <form ref={formRef} action={formAction} className="flex gap-3">
          <input type="hidden" name="thread_id" value={threadId} />
          <textarea
            name="content"
            required
            rows={2}
            placeholder="Votre réponse sécurisée…"
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
        <p className="text-[10px] text-gray-400 mt-1.5">Ctrl+Entrée pour envoyer · Chiffré de bout en bout</p>
      </div>
    </div>
  );
}
