'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Power, Loader2, CheckCircle2, XCircle } from 'lucide-react';

// Activation handshake: activates the case only after confirming the bracelet
// is reachable. Refuses (with a reason) when the device doesn't respond.
export default function ActivateMonitoringButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/cases/activate-monitoring', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caseId }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg({ ok: false, text: d.error ?? 'Échec' }); return; }
      setMsg({ ok: Boolean(d.activated), text: d.reason ?? '' });
      if (d.activated) router.refresh();
    } catch {
      setMsg({ ok: false, text: 'Erreur réseau' });
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={run}
        disabled={busy}
        data-tip="Vérifier que le bracelet répond, le configurer, puis activer la surveillance du dossier"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
        {busy ? 'Vérification du bracelet…' : 'Activer la surveillance'}
      </button>
      {msg && (
        <p className={`text-xs flex items-center gap-1 ${msg.ok ? 'text-emerald-600' : 'text-red-600'}`}>
          {msg.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          {msg.text}
        </p>
      )}
    </div>
  );
}
