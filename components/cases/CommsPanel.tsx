'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, PhoneCall, Plus, X } from 'lucide-react';

interface Contact { name: string; phone: string }

export default function CommsPanel({
  deviceId, imei, simNumber, sosNumbers, whitelist, callEnabled, canEdit,
}: {
  deviceId: string;
  imei: string;
  simNumber: string | null;
  sosNumbers: string[];
  whitelist: Contact[];
  callEnabled: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [sos, setSos] = useState<string[]>([sosNumbers[0] ?? '', sosNumbers[1] ?? '', sosNumbers[2] ?? '']);
  const [wl, setWl] = useState<Contact[]>(whitelist.length ? whitelist : [{ name: '', phone: '' }]);
  const [enabled, setEnabled] = useState(callEnabled);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/devices/comms', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, imei, sosNumbers: sos, whitelist: wl, callEnabled: enabled }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error ?? 'Erreur'); }
      else setMsg(d.delivered ? 'Envoyé au bracelet ✓' : 'Enregistré (bracelet hors ligne — sera poussé au prochain contact)');
      router.refresh();
    } catch { setMsg('Erreur réseau'); } finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <PhoneCall className="w-4 h-4 text-emerald-600" />
        <h3 className="font-semibold text-gray-900">Communication vocale</h3>
      </div>

      {/* Click-to-call the bracelet (two-way voice) */}
      {simNumber ? (
        <a href={`tel:${simNumber}`} className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-semibold">
          <Phone className="w-4 h-4" /> Appeler le bracelet ({simNumber})
        </a>
      ) : (
        <p className="text-xs text-amber-600">Numéro SIM non renseigné — impossible d&apos;appeler le bracelet.</p>
      )}

      {!canEdit ? (
        <div className="text-xs text-gray-500">
          <p>Numéros SOS : {sosNumbers.filter(Boolean).join(', ') || '—'}</p>
          <p>Appels {callEnabled ? 'activés' : 'désactivés'}</p>
        </div>
      ) : (
        <>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Numéros SOS (le bracelet les appelle sur appui SOS)</label>
            <div className="space-y-1.5">
              {sos.map((s, i) => (
                <input key={i} value={s} onChange={(e) => setSos(sos.map((v, j) => j === i ? e.target.value : v))}
                  placeholder={`SOS ${i + 1}`} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-mono" />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Liste blanche (numéros autorisés à appeler le bracelet)</label>
            <div className="space-y-1.5">
              {wl.map((c, i) => (
                <div key={i} className="flex gap-1.5">
                  <input value={c.name} onChange={(e) => setWl(wl.map((v, j) => j === i ? { ...v, name: e.target.value } : v))}
                    placeholder="Nom" className="w-1/3 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
                  <input value={c.phone} onChange={(e) => setWl(wl.map((v, j) => j === i ? { ...v, phone: e.target.value } : v))}
                    placeholder="Téléphone" className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-mono" />
                  <button onClick={() => setWl(wl.filter((_, j) => j !== i))} className="px-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ))}
              {wl.length < 5 && (
                <button onClick={() => setWl([...wl, { name: '', phone: '' }])} className="inline-flex items-center gap-1 text-xs text-blue-600"><Plus className="w-3.5 h-3.5" /> Ajouter</button>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Appels téléphoniques activés
          </label>

          {msg && <p className="text-xs text-gray-600">{msg}</p>}
          <button onClick={save} disabled={busy} className="w-full bg-gray-900 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">
            {busy ? 'Envoi…' : 'Enregistrer & envoyer au bracelet'}
          </button>
        </>
      )}
    </div>
  );
}
