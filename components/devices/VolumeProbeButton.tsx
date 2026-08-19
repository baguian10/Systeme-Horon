'use client';

import { useState } from 'react';
import { Volume2, Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

type Probe = { command: string; serial: string; sent: boolean; reply: string | null };

// Le protocole IW ne documente aucune commande de volume. Ce bouton en essaie
// plusieurs orthographes et montre laquelle le bracelet reconnaît : une réponse
// du terminal = commande comprise. Sans réponse, le firmware ne la connaît pas.
export default function VolumeProbeButton({ imei }: { imei: string }) {
  const [busy, setBusy] = useState(false);
  const [level, setLevel] = useState(9);
  const [res, setRes] = useState<{ error?: string; probes: Probe[] } | null>(null);

  async function probe() {
    setBusy(true); setRes(null);
    try {
      const r = await fetch('/api/devices/volume', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imei, level }),
      });
      const d = await r.json();
      setRes(r.ok ? { probes: d.probes ?? [] } : { error: d.error ?? 'Échec', probes: [] });
    } catch { setRes({ error: 'Erreur réseau', probes: [] }); }
    finally { setBusy(false); }
  }

  const answered = res?.probes.filter((p) => p.reply) ?? [];
  const transmitted = res?.probes.filter((p) => p.sent).length ?? 0;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="inline-flex items-center gap-1.5">
        <button
          onClick={probe}
          disabled={busy}
          data-tip="Essayer plusieurs commandes de volume non documentées et voir laquelle le bracelet reconnaît"
          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg text-violet-700 bg-violet-50 hover:bg-violet-100 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />} Tester le volume
        </button>
        <select
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          disabled={busy}
          data-tip="Niveau demandé (9 = maximum)"
          className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 text-gray-600 disabled:opacity-50"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>Niveau {n}{n === 9 ? ' (max)' : ''}</option>)}
        </select>
      </div>

      {busy && <p className="text-[10px] text-gray-400">Envoi puis attente de la réponse du bracelet (~15 s)…</p>}

      {res && (
        <div className="text-[10px] max-w-md">
          {res.error ? (
            <p className="flex items-center gap-1 text-red-600"><XCircle className="w-3 h-3" /> {res.error}</p>
          ) : answered.length > 0 ? (
            <p className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="w-3 h-3" /> {answered.length} commande{answered.length > 1 ? 's' : ''} reconnue{answered.length > 1 ? 's' : ''} — écouter le bracelet pour confirmer l&apos;effet.
            </p>
          ) : (
            <p className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="w-3 h-3" /> Aucune réponse ({transmitted}/{res.probes.length} transmises) — le firmware ne connaît aucune de ces commandes, ou le bracelet est hors ligne.
            </p>
          )}
          {res.probes.length > 0 && (
            <ul className="mt-0.5 space-y-0.5 text-gray-600">
              {res.probes.map((p) => (
                <li key={p.serial}>
                  • <span className="font-mono select-all">{p.command}</span>{' '}
                  {p.reply
                    ? <span className="text-emerald-600 font-medium">→ {p.reply}</span>
                    : <span className="text-gray-400">→ {p.sent ? 'aucune réponse' : 'non transmise'}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
