'use client';

import { useState, useTransition } from 'react';
import { deleteUserAction } from '@/app/sigep/dashboard/users/actions';

export default function DeleteUserButton({ userId, name }: { userId: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!confirm(`Supprimer définitivement le compte de ${name} ? Cette action est irréversible.`)) return;
    const fd = new FormData();
    fd.set('user_id', userId);
    startTransition(async () => {
      const res = await deleteUserAction(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 text-red-700 bg-red-50 hover:bg-red-100"
      >
        {isPending ? '...' : 'Supprimer'}
      </button>
      {error && <span className="text-[10px] text-red-600 max-w-[180px] text-right">{error}</span>}
    </div>
  );
}
