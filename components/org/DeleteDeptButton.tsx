'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteDepartmentAction } from '@/app/sigep/dashboard/organisation/actions';

export default function DeleteDeptButton({ id, name }: { id: string; name: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Supprimer « ${name} » ? Les sous-entités et agents rattachés seront détachés de cette entité.`))
      return;
    setError(null);
    const fd = new FormData();
    fd.set('id', id);
    startTransition(async () => {
      const result = await deleteDepartmentAction(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="ml-auto flex flex-col items-end gap-0.5">
      <button
        onClick={handleClick}
        disabled={pending}
        data-tip="Supprimer cette entité. Les sous-entités et agents rattachés sont détachés (non supprimés)."
        className="text-gray-300 hover:text-red-500 disabled:opacity-40"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      {error && <span className="text-[10px] text-red-600 max-w-[220px] text-right leading-tight">{error}</span>}
    </div>
  );
}
