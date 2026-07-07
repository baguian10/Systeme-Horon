'use client';

import { useActionState, useState } from 'react';
import { Send, Users } from 'lucide-react';
import { createThreadAction } from './actions';

const INPUT = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', JUDGE: 'Juge',
  OPERATIONAL: 'Agent', STRATEGIC: 'Stratégique',
};

interface Recipient { id: string; full_name: string; role: string }

export default function NewThreadForm({ currentUserId, recipients }: { currentUserId: string; recipients: Recipient[] }) {
  const [state, formAction, isPending] = useActionState(createThreadAction, null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="px-5 py-4 space-y-3">
      <input type="hidden" name="sender_id" value={currentUserId} />

      {state?.error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">Message envoyé.</p>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1">
          <Users className="w-3 h-3" /> Destinataires * ({selected.size} sélectionné{selected.size > 1 ? 's' : ''})
        </label>
        <div className="border border-gray-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-gray-50">
          {recipients.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-2.5">Aucun destinataire disponible</p>
          ) : recipients.map((r) => (
            <label key={r.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                name="recipient_ids"
                value={r.id}
                checked={selected.has(r.id)}
                onChange={() => toggle(r.id)}
                className="w-3.5 h-3.5 accent-emerald-600"
              />
              <span className="text-sm text-gray-800">{r.full_name}</span>
              <span className="text-[10px] text-gray-400 ml-auto">{ROLE_LABEL[r.role] ?? r.role}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">N° de dossier (optionnel)</label>
        <input name="case_number" type="text" placeholder="TIG-2024-XXXX" className={INPUT} />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Sujet *</label>
        <input name="subject" type="text" required placeholder="Objet du message…" className={INPUT} />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Message *</label>
        <textarea
          name="content"
          required
          rows={4}
          placeholder="Votre message sécurisé…"
          className={`${INPUT} resize-none`}
        />
      </div>

      <button
        type="submit"
        disabled={isPending || selected.size === 0}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 transition-colors"
      >
        <Send className="w-3.5 h-3.5" />
        {isPending ? 'Envoi…' : 'Envoyer'}
      </button>
    </form>
  );
}
