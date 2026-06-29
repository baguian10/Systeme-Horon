'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface SimInfo {
  sim_number: string | null;
  sim_carrier: string | null;
  sim_activated_at: string | null;
  sim_status: string | null;
}

const CARRIERS = ['ORANGE', 'MOOV', 'TELECEL', 'OTHER'];

export function simStatusMeta(status: string | null) {
  return status === 'SUSPENDED'
    ? { label: 'Suspendue', cls: 'bg-red-100 text-red-700' }
    : { label: 'Active', cls: 'bg-emerald-100 text-emerald-700' };
}

export default function SimPanel({ deviceId, sim, canEdit }: { deviceId: string; sim: SimInfo; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    simNumber: sim.sim_number ?? '',
    carrier: sim.sim_carrier ?? '',
    activatedAt: sim.sim_activated_at ?? '',
    status: sim.sim_status ?? 'ACTIVE',
  });

  const meta = simStatusMeta(sim.sim_status);

  async function save() {
    setBusy(true);
    try {
      await fetch('/api/devices/sim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, ...form }),
      });
      setOpen(false);
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="text-xs">
      <div className="font-mono text-gray-700">{sim.sim_number || <span className="text-amber-600">— SIM —</span>}</div>
      <div className="flex items-center gap-1.5 mt-0.5">
        {sim.sim_carrier && <span className="text-gray-400">{sim.sim_carrier}</span>}
        {sim.sim_number && <span className={`inline-block px-1.5 rounded-full text-[10px] font-medium ${meta.cls}`}>{meta.label}</span>}
        {canEdit && <button onClick={() => setOpen(true)} data-tip="Modifier la carte SIM : numéro, opérateur, date de mise en service, statut" className="text-blue-600 hover:underline ml-1">modifier</button>}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-3">Carte SIM</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Numéro SIM</label>
                <input value={form.simNumber} onChange={(e) => setForm({ ...form, simNumber: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Opérateur</label>
                  <select value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                    <option value="">—</option>
                    {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Statut</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm">
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspendue</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Mise en service le</label>
                <input type="date" value={form.activatedAt} onChange={(e) => setForm({ ...form, activatedAt: e.target.value })} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">Annuler</button>
                <button onClick={save} disabled={busy} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
