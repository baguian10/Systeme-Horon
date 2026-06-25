'use client';

import { useEffect, useState, useCallback } from 'react';
import { Home, MapPin, Loader2, RefreshCw } from 'lucide-react';

interface Presence { configured: boolean; atHome: boolean; lastIndoorAt: string | null }

// Shows BLE home-beacon presence (À domicile / Absent) + a "Localiser" command.
export default function CasePresencePanel({ imei, canCommand }: { imei: string; canCommand: boolean }) {
  const [presence, setPresence] = useState<Presence | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
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

  async function locate() {
    setLocating(true); setMsg(null);
    try {
      const r = await fetch('/api/track/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imei, action: 'locate' }),
      });
      const d = await r.json();
      setMsg(r.ok ? 'Commande envoyée au bracelet ✓' : (d.error ?? 'Erreur'));
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
            {presence.lastIndoorAt && (
              <span className="text-[11px] text-gray-400">
                · {new Date(presence.lastIndoorAt).toLocaleString('fr-FR')}
              </span>
            )}
          </div>
        )}

        {canCommand && (
          <div>
            <button onClick={locate} disabled={locating} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40">
              {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
              Localiser maintenant
            </button>
            {msg && <p className="text-xs text-gray-500 mt-1.5">{msg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
