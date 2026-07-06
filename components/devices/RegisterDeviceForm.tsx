'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { isValidImei, normalizeImei } from '@/lib/devices/imei';

// Register a new bracelet into stock (IMEI + SIM). SUPER_ADMIN.
export default function RegisterDeviceForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [imei, setImei] = useState('');
  const [sim, setSim] = useState('');
  const [model, setModel] = useState('Traxbean TR40');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const clean = normalizeImei(imei);
    if (!clean) { setErr('IMEI requis'); return; }
    if (!isValidImei(clean)) { setErr('IMEI invalide — 15 chiffres attendus (contrôle Luhn).'); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/devices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imei: clean, model, simNumber: sim }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? 'Erreur'); setBusy(false); return; }
      setImei(''); setSim(''); setOpen(false); setBusy(false);
      router.refresh();
    } catch { setErr('Erreur réseau'); setBusy(false); }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} data-tip="Enregistrer un nouveau bracelet dans le parc (IMEI + SIM)" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">
        <Plus className="w-4 h-4" /> Enregistrer un bracelet
      </button>
    );
  }

  return (
    <div className="flex items-end gap-2 flex-wrap bg-gray-50 border border-gray-200 rounded-xl p-3">
      <div>
        <label className="block text-[11px] text-gray-500 mb-1">IMEI *</label>
        <input value={imei} onChange={(e) => setImei(e.target.value)} inputMode="numeric" placeholder="3559326…" className="border border-gray-300 rounded px-2 py-1.5 text-xs font-mono w-40" />
        {imei.trim() !== '' && (() => {
          const clean = normalizeImei(imei);
          const ok = isValidImei(clean);
          return <p className={`text-[10px] mt-0.5 ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>{clean.length}/15 chiffres{ok ? ' · valide ✓' : ''}</p>;
        })()}
      </div>
      <div>
        <label className="block text-[11px] text-gray-500 mb-1">N° SIM</label>
        <input value={sim} onChange={(e) => setSim(e.target.value)} placeholder="226…" className="border border-gray-300 rounded px-2 py-1.5 text-xs font-mono w-36" />
      </div>
      <div>
        <label className="block text-[11px] text-gray-500 mb-1">Modèle</label>
        <input value={model} onChange={(e) => setModel(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 text-xs w-36" />
      </div>
      <button onClick={submit} disabled={busy} data-tip="Ajouter ce bracelet au stock (disponible pour assignation)" className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40">
        {busy ? '…' : 'Ajouter'}
      </button>
      <button onClick={() => { setOpen(false); setErr(null); }} className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs">Annuler</button>
      {err && <span className="text-xs text-red-600 w-full">{err}</span>}
    </div>
  );
}
