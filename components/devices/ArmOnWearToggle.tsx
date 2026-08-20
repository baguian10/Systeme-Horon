'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2 } from 'lucide-react';

// Armement à la pose : le dossier passe en surveillance active dès que la
// sangle se ferme sur la cheville. Ne concerne que les dossiers en attente.
export default function ArmOnWearToggle({ imei, active }: { imei: string; active: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(active);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle() {
    const next = !on;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/devices/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imei, kind: next ? 'armOnWearOn' : 'armOnWearOff' }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error ?? 'Échec'); return; }
      setOn(next);
      setMsg(next ? 'Armement à la pose activé' : 'Armement à la pose désactivé');
      router.refresh();
    } catch { setMsg('Erreur réseau'); }
    finally { setBusy(false); }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={toggle}
        disabled={busy}
        data-tip="Active la surveillance du dossier dès que la sangle se verrouille sur la cheville (dossiers en attente uniquement)"
        className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg disabled:opacity-50 ${
          on ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
        }`}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
        Armement à la pose {on ? '· actif' : '· inactif'}
      </button>
      {msg && <p className="text-[10px] text-gray-500">{msg}</p>}
    </div>
  );
}
