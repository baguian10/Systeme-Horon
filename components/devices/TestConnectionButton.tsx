'use client';

import { useState } from 'react';
import { Wifi, Loader2, CheckCircle2, XCircle } from 'lucide-react';

// Real connectivity test: forces a fix on the bracelet and confirms it comes
// back. Reflects the TRUE reachability, not the stored is_online flag.
export default function TestConnectionButton({ imei }: { imei: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ online: boolean; reason: string } | null>(null);

  async function run() {
    setBusy(true); setResult(null);
    try {
      const r = await fetch('/api/devices/test-connection', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imei }),
      });
      const d = await r.json();
      if (!r.ok) { setResult({ online: false, reason: d.error ?? 'Échec du test' }); return; }
      setResult({ online: Boolean(d.online), reason: d.reason ?? '' });
    } catch {
      setResult({ online: false, reason: 'Erreur réseau' });
    } finally { setBusy(false); }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={run}
        disabled={busy}
        data-tip="Interroger réellement le bracelet (forcer une position) et confirmer qu'il répond"
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
        {busy ? 'Test…' : 'Tester la connexion'}
      </button>
      {result && (
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${result.online ? 'text-emerald-600' : 'text-red-600'}`}>
          {result.online ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          {result.online ? 'Connecté' : 'Injoignable'}{result.reason ? ` — ${result.reason}` : ''}
        </span>
      )}
    </div>
  );
}
