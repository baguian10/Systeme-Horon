'use client';

import { useState } from 'react';
import { Crosshair, RotateCcw, Timer, Loader2 } from 'lucide-react';

// Real remote commands to a bracelet via the Traxbean platform
// (POST /api/track/command). Locate = force an immediate fix, Restart = reboot,
// Interval = change the GPS reporting cadence. Audit-logged server-side.
export default function DeviceCommandButtons({ imei }: { imei: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function send(action: 'locate' | 'restart' | 'setInterval', value?: number, label?: string) {
    setBusy(action); setMsg(null);
    try {
      const r = await fetch('/api/track/command', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imei, action, value }),
      });
      const d = await r.json().catch(() => ({}));
      setMsg(r.ok ? `${label ?? 'Commande'} ✓` : (d.error ?? 'Échec'));
    } catch {
      setMsg('Erreur réseau');
    } finally {
      setBusy(null);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  function restart() {
    if (confirm(`Redémarrer le bracelet ${imei} ?\n\nLe suivi est brièvement interrompu pendant le redémarrage.`)) {
      send('restart', undefined, 'Redémarrage demandé');
    }
  }
  function setInterval() {
    const v = prompt('Intervalle de report GPS, en secondes (10 à 86400) :', '60');
    if (v == null) return;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 10 || n > 86400) { setMsg('Valeur invalide (10–86400 s)'); setTimeout(() => setMsg(null), 4000); return; }
    send('setInterval', Math.round(n), `Intervalle ${Math.round(n)}s`);
  }

  const btn = 'inline-flex items-center gap-1 text-xs disabled:opacity-50';
  return (
    <span className="inline-flex items-center gap-3 flex-wrap">
      <button onClick={() => send('locate', undefined, 'Localisation demandée')} disabled={busy !== null} data-tip="Forcer une localisation GPS immédiate du bracelet" className={`${btn} text-blue-600 hover:text-blue-700`}>
        {busy === 'locate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />} Localiser
      </button>
      <button onClick={restart} disabled={busy !== null} data-tip="Redémarrer le bracelet à distance" className={`${btn} text-amber-600 hover:text-amber-700`}>
        {busy === 'restart' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Redémarrer
      </button>
      <button onClick={setInterval} disabled={busy !== null} data-tip="Modifier la fréquence de report GPS du bracelet" className={`${btn} text-gray-500 hover:text-gray-700`}>
        {busy === 'setInterval' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Timer className="w-3.5 h-3.5" />} Intervalle
      </button>
      {msg && <span className="text-[11px] text-gray-500">{msg}</span>}
    </span>
  );
}
