'use client';

import { useState } from 'react';
import { Settings2, Phone, Clock, ShieldAlert, Signal, Loader2, PersonStanding, ShieldOff, ShieldCheck } from 'lucide-react';

// Hoisted to module scope so it keeps a stable identity across renders
// (defining it inside the component would remount every button each render).
function ConfigBtn({
  k, val, label, icon, busy, onSend,
}: {
  k: string;
  val?: string;
  label: string;
  icon: React.ReactNode;
  busy: string | null;
  onSend: (kind: string, value: string | undefined, label: string) => void;
}) {
  return (
    <button onClick={() => onSend(k, val, label)} disabled={!!busy} data-tip={`Envoyer la configuration « ${label} » au bracelet`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold disabled:opacity-40">
      {busy === k ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}{label}
    </button>
  );
}

export default function DeviceConfigPanel({ imei }: { imei: string }) {
  const [sos, setSos] = useState('');
  const [strap, setStrap] = useState('5');
  const [apn, setApn] = useState<'orange' | 'moov'>('orange');
  const [fallSens, setFallSens] = useState('1000');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function send(kind: string, value: string | undefined, label: string) {
    setBusy(kind); setMsg(null);
    try {
      const r = await fetch('/api/devices/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imei, kind, value }),
      });
      const d = await r.json();
      setMsg(r.ok ? `${label} envoyé ✓` : (d.error ?? 'Erreur'));
    } catch { setMsg('Erreur réseau'); } finally { setBusy(null); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-slate-500" />
        <h3 className="font-semibold text-gray-900">Configuration du bracelet</h3>
        <span className="text-[11px] text-gray-400">· technique</span>
      </div>
      <div className="px-5 py-4 space-y-3 text-sm">
        {/* SOS */}
        <div className="flex items-center gap-2 flex-wrap">
          <Phone className="w-4 h-4 text-gray-400" />
          <input value={sos} onChange={(e) => setSos(e.target.value)} placeholder="Numéro SOS (centre)" className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-44" />
          <ConfigBtn k="sos" val={sos} label="Définir SOS" icon={<Phone className="w-3.5 h-3.5" />} busy={busy} onSend={send} />
        </div>
        {/* APN */}
        <div className="flex items-center gap-2 flex-wrap">
          <Signal className="w-4 h-4 text-gray-400" />
          <select value={apn} onChange={(e) => setApn(e.target.value as 'orange' | 'moov')} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
            <option value="orange">Orange BF (613-02)</option>
            <option value="moov">Moov Africa (613-03)</option>
          </select>
          <ConfigBtn k="apn" val={apn} label="Configurer APN" icon={<Signal className="w-3.5 h-3.5" />} busy={busy} onSend={send} />
        </div>
        {/* Strap */}
        <div className="flex items-center gap-2 flex-wrap">
          <ShieldAlert className="w-4 h-4 text-gray-400" />
          <input value={strap} onChange={(e) => setStrap(e.target.value)} type="number" min={1} max={10} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-16" />
          <ConfigBtn k="strap" val={strap} label="Sensibilité sangle" icon={<ShieldAlert className="w-3.5 h-3.5" />} busy={busy} onSend={send} />
        </div>
        {/* Timezone */}
        <div className="flex items-center gap-2 flex-wrap">
          <Clock className="w-4 h-4 text-gray-400" />
          <ConfigBtn k="timezoneBF" label="Fuseau Burkina (GMT)" icon={<Clock className="w-3.5 h-3.5" />} busy={busy} onSend={send} />
        </div>

        <div className="border-t border-gray-50 pt-3 mt-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase mb-2">Sécurité du porteur</p>
          {/* Wearing / removal detection */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <ShieldCheck className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-600 mr-1">Détection de retrait :</span>
            <ConfigBtn k="wearOn" label="Activer" icon={<ShieldCheck className="w-3.5 h-3.5" />} busy={busy} onSend={send} />
            <ConfigBtn k="wearOff" label="Désactiver" icon={<ShieldOff className="w-3.5 h-3.5" />} busy={busy} onSend={send} />
          </div>
          {/* Fall detection */}
          <div className="flex items-center gap-2 flex-wrap">
            <PersonStanding className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-600 mr-1">Détection de chute :</span>
            <ConfigBtn k="fallOn" label="Activer" icon={<PersonStanding className="w-3.5 h-3.5" />} busy={busy} onSend={send} />
            <ConfigBtn k="fallOff" label="Désactiver" icon={<ShieldOff className="w-3.5 h-3.5" />} busy={busy} onSend={send} />
            <input value={fallSens} onChange={(e) => setFallSens(e.target.value)} type="number" min={100} max={5000} step={100} title="Seuil de sensibilité : plus petit = plus sensible" className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-20" />
            <ConfigBtn k="fallSensitivity" val={fallSens} label="Sensibilité" icon={<PersonStanding className="w-3.5 h-3.5" />} busy={busy} onSend={send} />
          </div>
        </div>
        {msg && <p className="text-xs text-gray-500">{msg}</p>}
      </div>
    </div>
  );
}
