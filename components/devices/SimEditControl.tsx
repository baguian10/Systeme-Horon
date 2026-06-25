'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Inline edit of a bracelet's SIM card number. SUPER_ADMIN.
export default function SimEditControl({ deviceId, current }: { deviceId: string; current: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await fetch('/api/devices/sim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, simNumber: value }),
      });
      setEditing(false);
      router.refresh();
    } finally { setBusy(false); }
  }

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="text-xs text-gray-600 hover:text-emerald-600 font-mono">
        {current || <span className="text-amber-600">+ SIM</span>}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="N° SIM"
        className="w-28 border border-gray-300 rounded px-1.5 py-1 text-xs font-mono"
      />
      <button onClick={save} disabled={busy} className="text-xs px-1.5 py-1 rounded bg-emerald-600 text-white">✓</button>
      <button onClick={() => { setEditing(false); setValue(current ?? ''); }} className="text-xs px-1.5 py-1 rounded bg-gray-100">✕</button>
    </div>
  );
}
