'use client';

import { useEffect, useState, useCallback } from 'react';
import { Home, MapPin, Loader2, RefreshCw, RotateCw, Bluetooth, Zap, Power, Timer } from 'lucide-react';

interface Presence { configured: boolean; atHome: boolean; rssi: number | null; lastIndoorAt: string | null }
type Action = 'locate' | 'enableBle' | 'restart' | 'realtime' | 'setInterval' | 'shutdown';

// Shows BLE home-beacon presence (À domicile / Absent) + remote commands.
export default function CasePresencePanel({ imei, canCommand, canShutdown }: { imei: string; canCommand: boolean; canShutdown: boolean }) {
  const [presence, setPresence] = useState<Presence | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [intervalSec, setIntervalSec] = useState(30);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/track/presence?imei=${encodeURIComponent(imei)}`, { cache: 'no-store' });
      const d = await r.json();
      setPresence(d);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [imei]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  async function sendCmd(action: Action, okMsg: string, value?: number) {
    setLocating(true); setMsg(null);
    try {
      const r = await fetch('/api/track/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imei, action, value }),
      });
      const d = await r.json();
      setMsg(r.ok ? okMsg : (d.error ?? 'Erreur'));
      setTimeout(load, 4000);
    } catch { setMsg('Erreur réseau'); } finally { setLocating(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-emerald-500" />
          <h3 className="font-semibold text-gray-900">Présence & commandes</h3>
        </div>
        <button onClick={load} title="Rafraîchir" className="text-gray-400 hover:text-gray-700"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      <div className="px-5 py-4 space-y-3">
        {loading ? (
          <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</p>
        ) : !presence?.configured ? (
          <p className="text-sm text-amber-600">Domicile (beacon) non configuré pour ce bracelet.</p>
        ) : (
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${presence.atHome ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span className={`text-sm font-semibold ${presence.atHome ? 'text-emerald-700' : 'text-gray-500'}`}>
              {presence.atHome ? 'À domicile (beacon détecté)' : 'Absent du domicile'}
            </span>
            {presence.atHome && presence.rssi != null && (
              <span className="text-[11px] text-gray-400">· signal {presence.rssi} dBm</span>
            )}
            {presence.lastIndoorAt && (
              <span className="text-[11px] text-gray-400">
                · {new Date(presence.lastIndoorAt).toLocaleTimeString('fr-FR')}
              </span>
            )}
          </div>
        )}

        {canCommand && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => sendCmd('locate', 'Localisation demandée ✓')} disabled={locating} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40">
              {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
              Localiser
            </button>
            <button onClick={() => sendCmd('enableBle', 'Activation Bluetooth envoyée ✓ (scan 120s)')} disabled={locating} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-40">
              <Bluetooth className="w-3.5 h-3.5" /> Activer Bluetooth
            </button>
            <button onClick={() => sendCmd('realtime', 'Mode temps réel intensif envoyé ✓ (position 10s)')} disabled={locating} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold disabled:opacity-40">
              <Zap className="w-3.5 h-3.5" /> Temps réel intensif
            </button>
            <button onClick={() => { if (confirm('Redémarrer le bracelet ? Le suivi reprend après le reboot.')) sendCmd('restart', 'Redémarrage envoyé ✓'); }} disabled={locating} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-xs font-semibold disabled:opacity-40">
              <RotateCw className="w-3.5 h-3.5" /> Redémarrer
            </button>
            <div className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
              <Timer className="w-3.5 h-3.5 text-gray-500" />
              <input type="number" min={10} max={86400} value={intervalSec} onChange={(e) => setIntervalSec(Number(e.target.value))} className="w-16 text-xs px-1 py-0.5 border border-gray-300 rounded" />
              <span className="text-[11px] text-gray-500">s</span>
              <button onClick={() => sendCmd('setInterval', `Intervalle position réglé à ${intervalSec}s ✓`, intervalSec)} disabled={locating} className="text-xs font-semibold text-blue-600 hover:text-blue-700 ml-1">Régler</button>
            </div>
            {canShutdown && (
              <button onClick={() => { if (confirm('⚠️ ÉTEINDRE le bracelet ? Cela COUPE le suivi GPS jusqu’au rallumage manuel.')) sendCmd('shutdown', 'Extinction envoyée ✓'); }} disabled={locating} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold disabled:opacity-40">
                <Power className="w-3.5 h-3.5" /> Éteindre
              </button>
            )}
            {msg && <p className="text-xs text-gray-500 w-full">{msg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
