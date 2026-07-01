'use client';

import { useState } from 'react';
import { Radar, Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

type Sighting = { name: string; mac: string; rssi: number; meters: number };

// Manual BLE scan in front of a tracker — find a beacon's MAC to pair it.
export default function BleScanButton({ imei }: { imei: string }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ stale: boolean; reason: string; sightings: Sighting[] } | null>(null);

  async function scan() {
    setBusy(true); setRes(null);
    try {
      const r = await fetch('/api/devices/ble-scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imei }),
      });
      const d = await r.json();
      if (!r.ok) { setRes({ stale: true, reason: d.error ?? 'Échec', sightings: [] }); return; }
      setRes({ stale: Boolean(d.stale), reason: d.reason ?? '', sightings: Array.isArray(d.sightings) ? d.sightings : [] });
    } catch { setRes({ stale: true, reason: 'Erreur réseau', sightings: [] }); }
    finally { setBusy(false); }
  }

  const ok = res && !res.stale && res.sightings.length > 0;
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={scan}
        disabled={busy}
        data-tip="Activer le Bluetooth du bracelet et lister les balises détectées autour (pour trouver le MAC d'un beacon)"
        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg text-cyan-700 bg-cyan-50 hover:bg-cyan-100 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />} Scanner BLE
      </button>
      {res && (
        <div className="text-[10px]">
          <p className={`flex items-center gap-1 ${ok ? 'text-emerald-600' : res.stale ? 'text-amber-600' : 'text-red-600'}`}>
            {ok ? <CheckCircle2 className="w-3 h-3" /> : res.stale ? <AlertTriangle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {res.reason}
          </p>
          {res.sightings.length > 0 && (
            <ul className="mt-0.5 space-y-0.5 text-gray-600">
              {res.sightings.map((s) => (
                <li key={s.mac}>
                  • <span className="font-mono select-all">{s.mac}</span> {s.name && `(${s.name})`} — {s.rssi} dBm ≈ {s.meters} m
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
