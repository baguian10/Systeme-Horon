'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Wrench, RotateCcw, Loader2 } from 'lucide-react';

type Lifecycle = 'STOCK' | 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';

// Lifecycle transitions for a bracelet. RETIRED is a proper decommission for a
// device that has judicial history (and so can't be hard-deleted). Retiring
// requires the device to be unassigned first.
export default function DeviceLifecycleButton({
  deviceId, imei, lifecycle, assigned,
}: { deviceId: string; imei: string; lifecycle: Lifecycle; assigned: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function call(action: 'retire' | 'restore' | 'maintenance', reason?: string) {
    setBusy(true);
    try {
      const r = await fetch('/api/devices/lifecycle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, action, reason }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { alert(d.error ?? 'Action impossible.'); return; }
      router.refresh();
    } catch { alert('Erreur réseau.'); }
    finally { setBusy(false); }
  }

  function retire() {
    if (assigned) { alert('Désassignez le bracelet avant de le réformer.'); return; }
    const reason = prompt(`Réformer (mettre hors service) le bracelet ${imei} ?\n\nMotif (optionnel) :`, '');
    if (reason === null) return;
    call('retire', reason || undefined);
  }

  const btn = 'inline-flex items-center gap-1 text-xs disabled:opacity-50';
  if (busy) return <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> …</span>;

  if (lifecycle === 'RETIRED') {
    return (
      <button onClick={() => call('restore')} data-tip="Réactiver ce bracelet (retour en stock)" className={`${btn} text-emerald-600 hover:text-emerald-700`}>
        <RotateCcw className="w-3.5 h-3.5" /> Réactiver
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-3">
      {lifecycle === 'MAINTENANCE' ? (
        <button onClick={() => call('restore')} data-tip="Fin de maintenance — remettre en service/stock" className={`${btn} text-emerald-600 hover:text-emerald-700`}>
          <RotateCcw className="w-3.5 h-3.5" /> Fin maintenance
        </button>
      ) : (
        <button onClick={() => call('maintenance')} data-tip="Mettre en maintenance (hors service temporaire)" className={`${btn} text-amber-600 hover:text-amber-700`}>
          <Wrench className="w-3.5 h-3.5" /> Maintenance
        </button>
      )}
      {!assigned && (
        <button onClick={retire} data-tip="Réformer : mise hors service définitive (conservé pour l'audit)" className={`${btn} text-red-600 hover:text-red-700`}>
          <Archive className="w-3.5 h-3.5" /> Réformer
        </button>
      )}
    </span>
  );
}
