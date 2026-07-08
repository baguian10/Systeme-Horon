'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, FolderOpen, Search, Archive } from 'lucide-react';
import type { MessageThread } from '@/lib/supabase/types';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}j`;
  if (h > 0) return `${h}h`;
  return `${Math.floor(diff / 60000)}min`;
}

export default function ThreadsList({ threads, unreadByThread }: {
  threads: MessageThread[];
  unreadByThread: Record<string, number>;
}) {
  const [query, setQuery] = useState('');
  const [showClosed, setShowClosed] = useState(false);

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((t) => {
      if (!showClosed && t.closed_at) return false;
      if (!q) return true;
      return t.subject.toLowerCase().includes(q)
        || (t.case_number ?? '').toLowerCase().includes(q)
        || (t.last_message_preview ?? '').toLowerCase().includes(q);
    });
  }, [threads, query, showClosed]);

  const closedCount = threads.filter((t) => t.closed_at).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <h3 className="font-semibold text-gray-900 text-sm">Conversations ({view.length})</h3>
          </div>
          {closedCount > 0 && (
            <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="w-3 h-3 accent-emerald-600" />
              Afficher les clôturés ({closedCount})
            </label>
          )}
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un fil (sujet, dossier, contenu)…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {view.length === 0 ? (
        <div className="flex flex-col items-center py-14 gap-3 text-center">
          <MessageSquare className="w-10 h-10 text-gray-200" />
          <p className="text-sm text-gray-400">Aucune conversation</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {view.map((thread) => {
            const unread = unreadByThread[thread.id] ?? 0;
            return (
              <li key={thread.id}>
                <Link
                  href={`/sigep/dashboard/messagerie/${thread.id}`}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
                >
                  <div className={`relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${thread.closed_at ? 'bg-slate-100 text-slate-400' : 'bg-gray-100 text-gray-500'}`}>
                    {thread.closed_at ? <Archive className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <p className={`text-sm truncate transition-colors ${unread > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-900'} group-hover:text-emerald-700`}>
                        {thread.subject}
                        {thread.closed_at && <span className="ml-1.5 text-[9px] font-medium text-slate-400 uppercase">clôturé</span>}
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
                    <p className={`text-xs truncate ${unread > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>{thread.last_message_preview}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
