'use client';

import { useActionState, useState } from 'react';
import { ShieldAlert, ShieldCheck, Plus } from 'lucide-react';
import { defineObligationAction } from '@/app/sigep/dashboard/geofences/actions';

// Judge-facing, NON-technical perimeter obligation. Center = device's last
// position; the technical admin validates/traces it precisely afterwards.
export default function PerimeterObligationForm({ caseId }: { caseId: string }) {
  const [state, formAction, isPending] = useActionState(defineObligationAction, null);
  const [open, setOpen] = useState(false);
  const [isExclusion, setExcl] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
        <Plus className="w-3.5 h-3.5" /> Définir un périmètre (obligation)
      </button>
    );
  }

  return (
    <form action={formAction} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <input type="hidden" name="case_id" value={caseId} />
      <input type="hidden" name="is_exclusion" value={String(isExclusion)} />
      <p className="text-xs text-gray-500">Obligation judiciaire. L&apos;administrateur tracera/validera le périmètre précis ensuite.</p>

      <div>
        <label className="block text-[11px] text-gray-500 mb-1">Libellé *</label>
        <input name="name" required placeholder="Ex : Assignation domicile — Dapoya" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setExcl(false)} className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs font-semibold ${!isExclusion ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500'}`}>
          <ShieldCheck className="w-4 h-4" /> Zone autorisée
        </button>
        <button type="button" onClick={() => setExcl(true)} className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs font-semibold ${isExclusion ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}>
          <ShieldAlert className="w-4 h-4" /> Zone interdite
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Rayon (m)</label>
          <input name="radius_m" type="number" min={20} max={5000} defaultValue={200} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Horaire de</label>
          <input name="active_start" type="time" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">à</label>
          <input name="active_end" type="time" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-[11px] text-gray-500 mb-1">Note pour l&apos;administrateur</label>
        <input name="request_note" placeholder="Précisions sur le périmètre à tracer…" className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
      </div>

      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={isPending} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-40">
          {isPending ? '…' : 'Envoyer l’obligation'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs">Annuler</button>
      </div>
    </form>
  );
}
