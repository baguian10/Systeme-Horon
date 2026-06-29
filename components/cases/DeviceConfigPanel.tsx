'use client';

import { useState } from 'react';
import { Settings2, Phone, Clock, ShieldAlert, Signal, Loader2 } from 'lucide-react';

export default function DeviceConfigPanel({ imei }: { imei: string }) {
  const [sos, setSos] = useState('');
  const [strap, setStrap] = useState('5');
  const [apn, setApn] = useState<'orange' | 'moov'>('orange');
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

  const Btn = ({ k, val, label, icon }: { k: string; val?: string; label: string; icon: React.ReactNode }) => (
    <button onClick={() => send(k, val, label)} disabled={!!busy} data-tip={`Envoyer la configuration « ${label} » au bracelet`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold disabled:opacity-40">
      {busy === k ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}{label}
    </button>
  );

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
          <Btn k="sos" val={sos} label="Définir SOS" icon={<Phone className="w-3.5 h-3.5" />} />
        </div>
        {/* APN */}
        <div className="flex items-center gap-2 flex-wrap">
          <Signal className="w-4 h-4 text-gray-400" />
          <select value={apn} onChange={(e) => setApn(e.target.value as 'orange' | 'moov')} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
            <option value="orange">Orange BF (613-02)</option>
            <option value="moov">Moov Africa (613-03)</option>
          </select>
          <Btn k="apn" val={apn} label="Configurer APN" icon={<Signal className="w-3.5 h-3.5" />} />
        </div>
        {/* Strap */}
        <div className="flex items-center gap-2 flex-wrap">
          <ShieldAlert className="w-4 h-4 text-gray-400" />
          <input value={strap} onChange={(e) => setStrap(e.target.value)} type="number" min={1} max={10} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs w-16" />
          <Btn k="strap" val={strap} label="Sensibilité sangle" icon={<ShieldAlert className="w-3.5 h-3.5" />} />
        </div>
        {/* Timezone */}
        <div className="flex items-center gap-2 flex-wrap">
          <Clock className="w-4 h-4 text-gray-400" />
          <Btn k="timezoneBF" label="Fuseau Burkina (GMT)" icon={<Clock className="w-3.5 h-3.5" />} />
        </div>
        {msg && <p className="text-xs text-gray-500">{msg}</p>}
      </div>
    </div>
  );
}
