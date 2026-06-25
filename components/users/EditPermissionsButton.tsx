'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateUserPermissionsAction } from '@/app/sigep/dashboard/users/actions';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function EditPermissionsButton({ userId, name, current }: { userId: string; name: string; current: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[]>(current);
  const [busy, setBusy] = useState(false);

  function toggle(key: string) {
    setSel((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  }

  async function save() {
    setBusy(true);
    const fd = new FormData();
    fd.set('user_id', userId);
    sel.forEach((k) => fd.append('permissions', k));
    await updateUserPermissionsAction(fd);
    setBusy(false); setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => { setSel(current); setOpen(true); }} className="text-xs font-medium px-2.5 py-1 rounded-lg text-fuchsia-700 bg-fuchsia-50 hover:bg-fuchsia-100">
        Permissions
      </button>
      {open && (
        <div className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 mb-1">Permissions de {name}</h3>
            <p className="text-xs text-gray-400 mb-4">Cochez/décochez les accès. Modifiable à tout moment.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(PERMISSIONS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 cursor-pointer hover:bg-fuchsia-50">
                  <input type="checkbox" checked={sel.includes(key)} onChange={() => toggle(key)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">Annuler</button>
              <button onClick={save} disabled={busy} className="px-3 py-1.5 rounded-lg bg-fuchsia-600 text-white text-sm font-semibold disabled:opacity-40">
                {busy ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
