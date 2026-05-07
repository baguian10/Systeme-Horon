'use client';

import { useTransition, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { forcePasswordResetAction } from '@/app/sigep/dashboard/users/actions';

export default function ForceResetButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function handleReset() {
    const fd = new FormData();
    fd.set('user_id', userId);
    startTransition(async () => {
      const result = await forcePasswordResetAction(fd);
      if (result.success) setMessage({ type: 'success', text: result.success });
      if (result.error)   setMessage({ type: 'error',   text: result.error });
      setTimeout(() => setMessage(null), 4000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleReset}
        disabled={isPending}
        title="Forcer la réinitialisation du mot de passe"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <KeyRound className="w-3.5 h-3.5" />
        {isPending ? 'Envoi...' : 'Réinitialiser MDP'}
      </button>
      {message && (
        <span className={`text-[10px] font-medium ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
