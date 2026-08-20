'use client';

import { useState } from 'react';
import { Timer, Loader2 } from 'lucide-react';

// Cadence de position du bracelet.
//
// C'est elle qui décide de tout le reste : à soixante secondes, une personne en
// voiture parcourt un kilomètre entre deux points et le trajet devient une
// ligne droite à travers les pâtés de maisons ; à cinq secondes, les virages
// apparaissent. Le prix est la batterie, et il est lourd — mesuré à environ
// 9 % par heure à dix secondes sur le HORON X. Le choix appartient donc à
// l'opérateur, dossier par dossier, et l'écran dit franchement ce qu'il coûte.
const CADENCES = [
  { s: 5,   label: '5 s',   note: 'suivi fin — autonomie très réduite' },
  { s: 10,  label: '10 s',  note: 'suivi précis — autonomie réduite' },
  { s: 30,  label: '30 s',  note: 'compromis' },
  { s: 60,  label: '1 min', note: 'économe — virages perdus' },
  { s: 300, label: '5 min', note: 'veille — position indicative' },
];

export default function ReportIntervalControl({ imei, current }: { imei: string; current?: number | null }) {
  const [value, setValue] = useState<number>(current ?? 30);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function apply(sec: number) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/track/command', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imei, action: 'setInterval', value: sec }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error ?? 'Échec'); return; }
      setValue(sec);
      setMsg(`Cadence portée à ${sec < 60 ? `${sec} s` : `${sec / 60} min`} — le bracelet applique au cycle suivant`);
    } catch { setMsg('Erreur réseau'); }
    finally { setBusy(false); }
  }

  const note = CADENCES.find((c) => c.s === value)?.note;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Timer className="w-3.5 h-3.5" />} Cadence
        </span>
        <select
          value={value}
          onChange={(e) => apply(Number(e.target.value))}
          disabled={busy}
          data-tip="Intervalle entre deux positions. Plus il est court, plus le trajet est fidèle — et plus la batterie s'épuise vite."
          className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 text-gray-700 disabled:opacity-50"
        >
          {CADENCES.map((c) => <option key={c.s} value={c.s}>{c.label}</option>)}
        </select>
      </div>
      {note && <p className="text-[10px] text-gray-400">{note}</p>}
      {msg && <p className="text-[10px] text-gray-500">{msg}</p>}
    </div>
  );
}
