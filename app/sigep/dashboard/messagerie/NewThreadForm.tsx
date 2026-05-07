'use client';

import { useActionState } from 'react';
import { Send } from 'lucide-react';
import { createThreadAction } from './actions';

const INPUT = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent';

export default function NewThreadForm({ currentUserId }: { currentUserId: string }) {
  const [state, formAction, isPending] = useActionState(createThreadAction, null);

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
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 transition-colors"
      >
        <Send className="w-3.5 h-3.5" />
        {isPending ? 'Envoi…' : 'Envoyer'}
      </button>
    </form>
  );
}
