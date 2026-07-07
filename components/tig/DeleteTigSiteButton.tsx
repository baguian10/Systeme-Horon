'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteTigSiteAction } from '@/app/sigep/dashboard/tig-sites/actions';

export default function DeleteTigSiteButton({ id, name }: { id: string; name: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Supprimer définitivement « ${name} » ? Cette action est irréversible.`)) return;
    setError(null);
    const fd = new FormData();
    fd.set('id', id);
    startTransition(async () => {
      const result = await deleteTigSiteAction(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={handleClick}
        disabled={pending}
        title="Supprimer ce site"
        className="text-gray-300 hover:text-red-500 disabled:opacity-40 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      {error && <span className="text-[10px] text-red-600 max-w-[220px] text-right leading-tight">{error}</span>}
    </div>
  );
}
