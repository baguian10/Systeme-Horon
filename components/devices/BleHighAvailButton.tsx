'use client';

import { useState } from 'react';
import { Bluetooth, Loader2, CheckCircle2, XCircle } from 'lucide-react';

// Applies the "high BLE availability" preset (position 60s + BLE 20s + eco off)
// to fight the firmware's motion-based BLE sleep for home surveillance.
export default function BleHighAvailButton({ imei, active = false }: { imei: string; active?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [on, setOn] = useState(active);
  const [fail, setFail] = useState(false);

  async function run() {
    setBusy(true); setFail(false);
    try {
      const r = await fetch('/api/devices/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imei, kind: 'bleHighAvail' }),
      });
      if (r.ok) setOn(true); else setFail(true);
    } catch { setFail(true); } finally { setBusy(false); }
  }

  return (
    <button
      onClick={run}
      disabled={busy}
      data-tip="Mode haute disponibilité BLE : position 60s + scan BLE 20s + éco off, pour garder la balise domicile détectée. Cliquer pour (ré)appliquer."
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg disabled:opacity-50 ${
        on ? 'text-white bg-sky-600 hover:bg-sky-500' : 'text-sky-700 bg-sky-50 hover:bg-sky-100'
      }`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : fail ? <XCircle className="w-3.5 h-3.5 text-red-600" />
        : on ? <CheckCircle2 className="w-3.5 h-3.5" />
        : <Bluetooth className="w-3.5 h-3.5" />}
      Haute dispo BLE{on ? ' ✓' : ''}
    </button>
  );
}
