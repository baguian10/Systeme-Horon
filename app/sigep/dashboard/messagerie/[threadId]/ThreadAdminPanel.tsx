'use client';

import { useState, useTransition } from 'react';
import { UserPlus, UserMinus, Archive, ArchiveRestore, ChevronDown, ChevronUp } from 'lucide-react';
import { addParticipantAction, removeParticipantAction, closeThreadAction, reopenThreadAction } from '../actions';

interface Person { id: string; full_name: string }

export default function ThreadAdminPanel({
  threadId, participants, addable, createdBy, canManage, isClosed, isSuperAdmin,
}: {
  threadId: string;
  participants: Person[];
  addable: Person[];
  createdBy: string;
  canManage: boolean;
  isClosed: boolean;
  isSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [addId, setAddId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: (fd: FormData) => Promise<{ error?: string } | void>, fields: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    setMsg(null);
    startTransition(async () => {
      const r = await action(fd);
      if (r?.error) setMsg(r.error);
    });
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800"
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Participants et gestion du fil
      </button>

      {open && (
        <div className="mt-2 border-t border-gray-50 pt-2 space-y-2">
          {/* Participant chips */}
          <div className="flex flex-wrap gap-1.5">
            {participants.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1 text-[11px] bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5 text-gray-700">
                {p.full_name}
                {p.id === createdBy && <span className="text-[9px] text-gray-400">(créateur)</span>}
                {canManage && !isClosed && p.id !== createdBy && participants.length > 2 && (
                  <button
                    onClick={() => run(removeParticipantAction, { thread_id: threadId, user_id: p.id })}
                    disabled={pending}
                    title="Retirer du fil"
                    className="text-gray-300 hover:text-red-500 disabled:opacity-40"
                  >
                    <UserMinus className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>

          {/* Add participant */}
          {canManage && !isClosed && addable.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={addId}
                onChange={(e) => setAddId(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs flex-1 max-w-[220px]"
              >
                <option value="">— Ajouter un participant —</option>
                {addable.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              <button
                onClick={() => { if (addId) { run(addParticipantAction, { thread_id: threadId, user_id: addId }); setAddId(''); } }}
                disabled={pending || !addId}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 disabled:opacity-40"
              >
                <UserPlus className="w-3.5 h-3.5" /> Ajouter
              </button>
            </div>
          )}

          {/* Lifecycle */}
          <div className="flex items-center gap-3">
            {canManage && !isClosed && (
              <button
                onClick={() => { if (confirm('Clôturer ce fil ? Il passera en lecture seule (archive).')) run(closeThreadAction, { thread_id: threadId }); }}
                disabled={pending}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-40"
              >
                <Archive className="w-3.5 h-3.5" /> Clôturer le fil
              </button>
            )}
            {isSuperAdmin && isClosed && (
              <button
                onClick={() => run(reopenThreadAction, { thread_id: threadId })}
                disabled={pending}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-40"
              >
                <ArchiveRestore className="w-3.5 h-3.5" /> Rouvrir (SUPER_ADMIN)
              </button>
            )}
          </div>

          {msg && <p className="text-xs text-red-600">{msg}</p>}
        </div>
      )}
    </div>
  );
}
