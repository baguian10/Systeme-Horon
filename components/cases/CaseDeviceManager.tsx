'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, Link2, Unlink } from 'lucide-react';

interface DeviceOpt { id: string; imei: string }

export default function CaseDeviceManager({
  caseId,
  current,
  spares,
  canManage,
}: {
  caseId: string;
  current: DeviceOpt | null;
  spares: DeviceOpt[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function assign(deviceId: string, attach: boolean) {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/devices/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, caseId: attach ? caseId : null }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'Erreur'); setBusy(false); return; }
      router.refresh();
    } catch { setErr('Erreur réseau'); setBusy(false); }
  }

  if (!canManage) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
        <Cpu className="w-4 h-4 text-emerald-500" />
        <h3 className="font-semibold text-gray-900">Bracelet GPS</h3>
      </div>
      <div className="px-5 py-4 space-y-3">
        {current ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-mono text-gray-800">{current.imei}</p>
            <button onClick={() => assign(current.id, false)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 disabled:opacity-40">
              <Unlink className="w-3.5 h-3.5" /> Retirer
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-400 mb-2">Aucun bracelet assigné.</p>
            <div className="flex items-center gap-2">
              <select value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
                <option value="">— Choisir un bracelet disponible —</option>
                {spares.map((d) => <option key={d.id} value={d.id}>{d.imei}</option>)}
              </select>
              <button onClick={() => pick && assign(pick, true)} disabled={busy || !pick} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40">
                <Link2 className="w-3.5 h-3.5" /> Assigner
              </button>
            </div>
            {spares.length === 0 && <p className="text-[11px] text-amber-600 mt-1">Aucun bracelet disponible — enregistrez-en un (page Bracelets).</p>}
          </div>
        )}
        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
    </div>
  );
}
