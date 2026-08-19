'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhoneIncoming, Plus, X, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';

interface Contact { name: string; phone: string }

const MAX = 10; // le protocole IW (BP14) accepte dix contacts

// Numéros autorisés à appeler le bracelet, au niveau du matériel — utilisable
// même quand le bracelet n'est encore rattaché à aucun dossier.
//
// Deux commandes, indissociables : BP14 écrit les numéros, BP84 arme le filtre.
// Sans BP84, la liste est décorative — le protocole laisse alors n'importe quel
// numéro appeler, et ne s'en sert que pour les commandes SMS.
export default function CallWhitelistPanel({
  deviceId, imei, whitelist, whitelistOnly, callEnabled,
}: {
  deviceId: string;
  imei: string;
  whitelist: Contact[];
  whitelistOnly: boolean;
  callEnabled: boolean;
}) {
  const router = useRouter();
  const [list, setList] = useState<Contact[]>(whitelist.length ? whitelist : [{ name: '', phone: '' }]);
  const [only, setOnly] = useState(whitelistOnly);
  const [calls, setCalls] = useState(callEnabled);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (i: number, patch: Partial<Contact>) =>
    setList(list.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const filled = list.filter((c) => c.phone.trim());

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/devices/comms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, imei, whitelist: filled, whitelistOnly: only, callEnabled: calls }),
      });
      const d = await res.json();
      if (!res.ok) setMsg(d.error ?? 'Échec');
      else setMsg(d.delivered
        ? `Envoyé au bracelet ✓ — ${filled.length} numéro${filled.length > 1 ? 's' : ''} autorisé${filled.length > 1 ? 's' : ''}`
        : 'Enregistré, mais le bracelet n\'a pas confirmé (hors ligne) — à renvoyer au prochain contact.');
      router.refresh();
    } catch { setMsg('Erreur réseau'); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <PhoneIncoming className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-gray-700">Numéros autorisés à appeler le bracelet</h3>
      </div>
      <p className="text-[11px] text-gray-500">
        Conversation bidirectionnelle : ces numéros peuvent appeler le porteur, qui décroche automatiquement.
        Dix au maximum.
      </p>

      <div className="space-y-1.5">
        {list.map((c, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              value={c.name}
              onChange={(e) => set(i, { name: e.target.value })}
              placeholder="Nom (ex. Juge Ouédraogo)"
              className="w-2/5 border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
            />
            <input
              value={c.phone}
              onChange={(e) => set(i, { phone: e.target.value })}
              placeholder="+226 70 00 00 00"
              inputMode="tel"
              className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-mono"
            />
            <button
              onClick={() => setList(list.length > 1 ? list.filter((_, j) => j !== i) : [{ name: '', phone: '' }])}
              data-tip="Retirer ce numéro"
              className="px-2 text-gray-400 hover:text-red-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {list.length < MAX ? (
        <button
          onClick={() => setList([...list, { name: '', phone: '' }])}
          data-tip="Ajouter un numéro autorisé"
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter un numéro
        </button>
      ) : (
        <p className="text-[10px] text-gray-400">Maximum atteint ({MAX} numéros).</p>
      )}

      <div className="pt-2 border-t border-gray-100 space-y-2">
        <label className="flex items-start gap-2 text-xs text-gray-700">
          <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} className="mt-0.5" />
          <span>
            <span className="inline-flex items-center gap-1 font-medium">
              {only ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <ShieldOff className="w-3.5 h-3.5 text-amber-500" />}
              N&apos;accepter que ces numéros
            </span>
            <span className="block text-[10px] text-gray-500">
              Décoché, la liste ne filtre rien : n&apos;importe quel numéro peut joindre le bracelet.
            </span>
          </span>
        </label>

        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input type="checkbox" checked={calls} onChange={(e) => setCalls(e.target.checked)} />
          Fonction téléphone activée
        </label>
      </div>

      {msg && <p className="text-[11px] text-gray-600">{msg}</p>}

      <button
        onClick={save}
        disabled={busy}
        data-tip="Écrit les numéros sur le bracelet (BP14), puis arme le filtre (BP84) et l'état des appels (BPPH)"
        className="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        {busy ? 'Envoi au bracelet…' : 'Enregistrer & envoyer au bracelet'}
      </button>
    </div>
  );
}
