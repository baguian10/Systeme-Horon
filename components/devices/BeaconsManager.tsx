'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bluetooth, Plus, Link2, Unlink, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface DeviceOpt { id: string; imei: string }
interface Beacon {
  id: string; uid: string; label: string | null; status: string;
  device_id: string | null;
  device?: { imei: string } | { imei: string }[] | null;
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'text-green-700 bg-green-50',
  FAULTY: 'text-red-700 bg-red-50',
  SPARE:  'text-amber-700 bg-amber-50',
};

// BLE beacon inventory: register, link to a bracelet, swap/unlink, mark faulty.
export default function BeaconsManager({ devices }: { devices: DeviceOpt[] }) {
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [uid, setUid] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/beacons', { cache: 'no-store' });
      const d = await r.json();
      setBeacons(Array.isArray(d.beacons) ? d.beacons : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function post(url: string, body: unknown) {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? 'Erreur'); return false; }
      await load();
      return true;
    } catch { setErr('Erreur réseau'); return false; }
    finally { setBusy(false); }
  }

  async function register() {
    if (!uid.trim()) { setErr('UID du beacon requis'); return; }
    if (await post('/api/beacons', { uid, label })) { setUid(''); setLabel(''); }
  }

  const imeiOf = (b: Beacon) => {
    const dev = Array.isArray(b.device) ? b.device[0] : b.device;
    return dev?.imei ?? null;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Bluetooth className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-700">Balises BLE (beacons domicile)</h3>
        <span className="text-xs text-gray-400">· {beacons.length}</span>
      </div>

      {/* Register */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-end gap-2 flex-wrap bg-gray-50">
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">UID / MAC du beacon *</label>
          <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" className="border border-gray-300 rounded px-2 py-1.5 text-xs font-mono w-48" />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Libellé</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Beacon domicile #1" className="border border-gray-300 rounded px-2 py-1.5 text-xs w-44" />
        </div>
        <button onClick={register} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40">
          <Plus className="w-4 h-4" /> Enregistrer beacon
        </button>
        {err && <span className="text-xs text-red-600 w-full">{err}</span>}
      </div>

      {/* List */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">UID</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Libellé</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Statut</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Bracelet lié</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {beacons.map((b) => {
              const imei = imeiOf(b);
              return (
                <tr key={b.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-mono text-xs text-gray-700">{b.uid}</td>
                  <td className="px-5 py-3 text-xs text-gray-600">{b.label ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_STYLE[b.status] ?? ''}`}>{b.status}</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-blue-700">{imei ?? <span className="text-gray-400">—</span>}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <select
                        value={b.device_id ?? ''}
                        onChange={(e) => post('/api/beacons/link', { beaconId: b.id, deviceId: e.target.value || null })}
                        disabled={busy}
                        className="border border-gray-300 rounded px-1.5 py-1 text-xs max-w-[150px]"
                      >
                        <option value="">— Non lié —</option>
                        {devices.map((d) => <option key={d.id} value={d.id}>{d.imei}</option>)}
                      </select>
                      {b.device_id && (
                        <button onClick={() => post('/api/beacons/link', { beaconId: b.id, deviceId: null })} title="Délier" className="p-1 text-gray-500 hover:text-red-600">
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {b.status !== 'FAULTY' ? (
                        <button onClick={() => post('/api/beacons/status', { beaconId: b.id, status: 'FAULTY' })} title="Marquer défaillant" className="p-1 text-gray-500 hover:text-red-600">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => post('/api/beacons/status', { beaconId: b.id, status: 'SPARE' })} title="Remettre en service" className="p-1 text-gray-500 hover:text-green-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {beacons.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-xs text-gray-400 flex items-center justify-center gap-2"><Link2 className="w-4 h-4" /> Aucun beacon enregistré</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
