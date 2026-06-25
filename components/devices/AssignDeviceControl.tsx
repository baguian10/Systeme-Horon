'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CaseSearchSelect from '@/components/geofences/CaseSearchSelect';

// Assign an unassigned bracelet to a case (SUPER_ADMIN). Searchable case picker.
export default function AssignDeviceControl({ deviceId }: { deviceId: string }) {
  const router = useRouter();
  const [caseId, setCaseId] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function assign() {
    if (!caseId) { setErr('Choisir un dossier'); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/devices/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, caseId }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? 'Erreur'); setBusy(false); return; }
      router.refresh();
    } catch { setErr('Erreur réseau'); setBusy(false); }
  }

  return (
    <div className="flex items-center gap-2 min-w-[280px]">
      <div className="flex-1">
        <CaseSearchSelect value={caseId} onChange={setCaseId} selectedLabel={label} onSelectedLabel={setLabel} />
      </div>
      <button
        type="button"
        onClick={assign}
        disabled={busy || !caseId}
        className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold whitespace-nowrap"
      >
        {busy ? '…' : 'Assigner'}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
