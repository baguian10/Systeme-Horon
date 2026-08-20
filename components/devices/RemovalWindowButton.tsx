'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Unlock, Loader2, ShieldAlert } from 'lucide-react';

const REASONS = ['Fin de mesure', 'Maintenance du matériel', 'Soins médicaux', 'Décision judiciaire', 'Remplacement du bracelet'];
const DURATIONS = [15, 30, 60, 120];

// Retrait autorisé : ouvre une fenêtre motivée et bornée pendant laquelle
// ouvrir la sangle est consigné sans lever d'alerte de sabotage. Au-delà,
// l'anti-retrait reprend seul — rien à refermer à la main.
export default function RemovalWindowButton({
  imei, until, reason,
}: {
  imei: string;
  until: string | null;
  reason: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(30);
  const [why, setWhy] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const active = Boolean(until) && Date.parse(until!) > Date.now();
  const leftMin = active ? Math.max(0, Math.round((Date.parse(until!) - Date.now()) / 60000)) : 0;

  async function send(payload: Record<string, unknown>) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/devices/removal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imei, ...payload }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error ?? 'Échec'); return; }
      setOpen(false);
      router.refresh();
    } catch { setMsg('Erreur réseau'); }
    finally { setBusy(false); }
  }

  if (active) {
    return (
      <div className="inline-flex flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg text-amber-700 bg-amber-50">
          <Unlock className="w-3.5 h-3.5" /> Retrait autorisé · {leftMin} min restantes
        </span>
        <span className="text-[10px] text-gray-500">{reason ?? 'motif non précisé'} — l&apos;ouverture ne lèvera pas d&apos;alerte</span>
        <button onClick={() => send({ cancel: true })} disabled={busy} className="text-[10px] text-red-600 hover:text-red-700 disabled:opacity-50">
          {busy ? 'Annulation…' : 'Annuler l’autorisation'}
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        onClick={() => setOpen(!open)}
        data-tip="Autoriser l'ouverture de la sangle sans déclencher d'alerte de sabotage, pour une durée limitée"
        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100"
      >
        <Unlock className="w-3.5 h-3.5" /> Autoriser le retrait
      </button>

      {open && (
        <div className="mt-1 p-2.5 rounded-xl border border-amber-100 bg-amber-50/40 space-y-2 w-64">
          <p className="text-[10px] text-gray-600 flex items-start gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-px" />
            Pendant la fenêtre, l&apos;ouverture est consignée sans alerte. Passé le délai, l&apos;anti-retrait reprend seul.
          </p>
          <label className="block text-[10px] text-gray-500">
            Motif
            <select value={why} onChange={(e) => setWhy(e.target.value)} className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1 text-xs">
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label className="block text-[10px] text-gray-500">
            Durée
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="mt-0.5 w-full border border-gray-300 rounded-lg px-2 py-1 text-xs">
              {DURATIONS.map((m) => <option key={m} value={m}>{m} minutes</option>)}
            </select>
          </label>
          <button
            onClick={() => send({ minutes, reason: why })}
            disabled={busy}
            className="w-full bg-gray-900 text-white rounded-lg py-1.5 text-xs font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Autoriser
          </button>
        </div>
      )}

      {msg && <p className="text-[10px] text-red-600">{msg}</p>}
    </div>
  );
}
