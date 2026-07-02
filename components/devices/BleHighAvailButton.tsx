'use client';

import { useState } from 'react';
import { Bluetooth, Loader2, CheckCircle2, XCircle } from 'lucide-react';

// Applies the "high BLE availability" preset (position 60s + BLE 20s + eco off)
// to fight the firmware's motion-based BLE sleep for home surveillance.
export default function BleHighAvailButton({ imei }: { imei: string }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<'ok' | 'fail' | null>(null);

  async function run() {
    setBusy(true); setRes(null);
    try {
      const r = await fetch('/api/devices/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imei, kind: 'bleHighAvail' }),
      });
      setRes(r.ok ? 'ok' : 'fail');
    } catch { setRes('fail'); } finally { setBusy(false); }
  }

  return (
    <button
      onClick={run}
      disabled={busy}
      data-tip="Mode haute disponibilité BLE : position 60s + scan BLE 20s + éco off, pour garder la balise domicile détectée"
      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg text-sky-700 bg-sky-50 hover:bg-sky-100 disabled:opacity-50"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : res === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        : res === 'fail' ? <XCircle className="w-3.5 h-3.5 text-red-600" />
        : <Bluetooth className="w-3.5 h-3.5" />}
      Haute dispo BLE
    </button>
  );
}
