'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';

// Delete an unassigned, history-free bracelet from the inventory. The server
// refuses deletion for any device that carries positions/alerts or is assigned,
// so this is safe for removing stock entered by mistake or never deployed.
export default function DeleteDeviceButton({ deviceId, imei }: { deviceId: string; imei: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm(`Supprimer définitivement le bracelet ${imei} de l'inventaire ?\n\nCette action est irréversible. Elle n'est possible que pour un bracelet non assigné et sans historique.`)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/devices/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { alert(d.error ?? 'Suppression impossible.'); return; }
      router.refresh();
    } catch {
      alert('Erreur réseau.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={del}
      disabled={busy}
      data-tip="Supprimer ce bracelet de l'inventaire (uniquement si non assigné et sans historique)"
      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Supprimer
    </button>
  );
}
