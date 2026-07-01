'use client';

import { useState } from 'react';
import { Rocket, Loader2, CheckCircle2, XCircle } from 'lucide-react';

// One-shot activation kit for a new/reassigned bracelet — applies the baseline
// device config (timezone, APN, BLE scan, removal detection) via real commands.
export default function ProvisionButton({ imei }: { imei: string }) {
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<{ step: string; ok: boolean }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true); setSteps(null); setErr(null);
    try {
      const r = await fetch('/api/devices/provision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imei, apn: 'orange' }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'Échec'); return; }
      setSteps(d.steps ?? []);
    } catch { setErr('Erreur réseau'); } finally { setBusy(false); }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={run}
        disabled={busy}
        data-tip="Configurer le bracelet en une fois : fuseau, APN, scan BLE, détection de retrait"
        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />} Kit d&apos;activation
      </button>
      {err && <span className="text-[10px] text-red-600">{err}</span>}
      {steps && (
        <div className="text-[10px] space-y-0.5">
          {steps.map((s) => (
            <div key={s.step} className={`flex items-center gap-1 ${s.ok ? 'text-emerald-600' : 'text-red-600'}`}>
              {s.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}{s.step}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
