'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bluetooth, Unlink, Link2 } from 'lucide-react';

interface BeaconOpt { id: string; uid: string; label: string | null; status?: string }

export default function CaseBeaconManager({
  caseId,
  hasDevice,
  current,
  spares,
  canManage,
}: {
  caseId: string;
  hasDevice: boolean;
  current: BeaconOpt | null;
  spares: BeaconOpt[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(action: 'link' | 'unlink', beaconId: string) {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/cases/beacon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, beaconId, action }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'Erreur'); setBusy(false); return; }
      router.refresh();
    } catch { setErr('Erreur réseau'); setBusy(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
        <Bluetooth className="w-4 h-4 text-blue-500" />
        <h3 className="font-semibold text-gray-900">Balise BLE (domicile)</h3>
      </div>
      <div className="px-5 py-4 space-y-3">
        {!hasDevice ? (
          <p className="text-sm text-gray-400">Assignez d&apos;abord un bracelet à ce dossier.</p>
        ) : current ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-800 font-mono">{current.uid}</p>
              <p className="text-xs text-gray-500">{current.label ?? 'Balise associée'} · {current.status}</p>
            </div>
            {canManage && (
              <button onClick={() => act('unlink', current.id)} disabled={busy} data-tip="Dissocier la balise BLE de ce bracelet (repasse en stock)" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-40">
                <Unlink className="w-3.5 h-3.5" /> Retirer
              </button>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-400 mb-2">Aucune balise associée.</p>
            {canManage && (
              <div className="flex items-center gap-2">
                <select value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
                  <option value="">— Choisir une balise disponible —</option>
                  {spares.map((b) => <option key={b.id} value={b.id}>{b.uid}{b.label ? ` (${b.label})` : ''}</option>)}
                </select>
                <button onClick={() => pick && act('link', pick)} disabled={busy || !pick} data-tip="Associer la balise BLE domicile au bracelet (présence à domicile)" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-40">
                  <Link2 className="w-3.5 h-3.5" /> Associer
                </button>
              </div>
            )}
            {spares.length === 0 && canManage && <p className="text-[11px] text-amber-600 mt-1">Aucune balise disponible — enregistrez-en une (compte admin, page Bracelets).</p>}
          </div>
        )}
        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
    </div>
  );
}
