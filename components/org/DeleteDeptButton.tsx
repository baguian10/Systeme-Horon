'use client';

import { Trash2 } from 'lucide-react';
import { deleteDepartmentAction } from '@/app/sigep/dashboard/organisation/actions';

export default function DeleteDeptButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteDepartmentAction}
      onSubmit={(e) => {
        if (!confirm(`Supprimer « ${name} » ? Les sous-entités et agents rattachés seront détachés de cette entité.`))
          e.preventDefault();
      }}
      className="ml-auto"
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        data-tip="Supprimer cette entité. Les sous-entités et agents rattachés sont détachés (non supprimés)."
        className="text-gray-300 hover:text-red-500"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}
