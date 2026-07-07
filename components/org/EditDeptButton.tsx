'use client';

import { useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { updateDepartmentAction } from '@/app/sigep/dashboard/organisation/actions';
import type { Department } from '@/lib/supabase/types';

export default function EditDeptButton({ dept, allDepts }: { dept: Department; allDepts: Department[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateDepartmentAction(fd);
      if (result?.error) { setError(result.error); return; }
      setOpen(false);
    });
  }

  const parentOptions = allDepts.filter((d) => d.id !== dept.id);

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null); }}
        data-tip="Modifier le nom, le type ou le rattachement de cette entité"
        className="text-gray-300 hover:text-blue-500"
      >
        <Pencil className="w-3 h-3" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 mb-4">Modifier « {dept.name} »</h3>
            <form onSubmit={submit} className="space-y-3">
              <input type="hidden" name="id" value={dept.id} />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nom *</label>
                <input
                  name="name"
                  required
                  defaultValue={dept.name}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select
                  name="type"
                  defaultValue={dept.type}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="COURT">Cour / Tribunal</option>
                  <option value="JURISDICTION">Juridiction</option>
                  <option value="UNIT">Unité / Service</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rattachée à</label>
                <select
                  name="parent_id"
                  defaultValue={dept.parent_id ?? ''}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                >
                  <option value="">— Racine —</option>
                  {parentOptions.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-40"
                >
                  {pending ? '…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
