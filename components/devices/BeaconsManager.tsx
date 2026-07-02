'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { Bluetooth, Plus, Link2, Unlink, AlertTriangle, CheckCircle2, Settings, Radar, Loader2 } from 'lucide-react';

interface DeviceOpt { id: string; imei: string }
interface Beacon {
  id: string; uid: string; label: string | null; status: string;
  device_id: string | null;
  device?: { imei: string } | { imei: string }[] | null;
  alarm_enabled?: boolean;
  max_distance_m?: number;
  grace_minutes?: number;
  notify_exit?: boolean;
  active_start?: string | null;
  active_end?: string | null;
  home_lat?: number | null;
  home_lng?: number | null;
  min_rssi?: number;
  alarm_mode?: 'GPS' | 'BLE' | 'BOTH';
  battery_changed_at?: string | null;
  ble_present?: boolean | null;
  ble_rssi?: number | null;
  ble_checked_at?: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'text-green-700 bg-green-50',
  FAULTY: 'text-red-700 bg-red-50',
  SPARE:  'text-amber-700 bg-amber-50',
};

const MODE_LABEL: Record<string, string> = { BLE: 'Proximité BLE', GPS: 'Rayon GPS', BOTH: 'GPS + BLE' };

// Minutes since an ISO timestamp (kept out of render for hook purity).
function minutesSince(iso?: string | null): number | null {
  if (!iso) return null;
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

// Read-only summary of the beacon's active alarm parameters (from the DB), so an
// operator sees the live config at a glance without opening the edit form.
function BeaconActiveParams({ b }: { b: Beacon }) {
  const mode = b.alarm_mode ?? 'BOTH';
  const bleM = b.min_rssi != null ? rssiToMeters(b.min_rssi) : null;
  const ageM = batteryAgeMonths(b.battery_changed_at);
  const chip = 'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium';
  // Live BLE connection: present/absent/unknown; stale (>15min) → unknown.
  const bleFresh = minutesSince(b.ble_checked_at) !== null && minutesSince(b.ble_checked_at)! < 15;
  const blePresent = bleFresh ? b.ble_present : null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {b.device_id && (
        <span className={`${chip} ${blePresent === true ? 'bg-emerald-100 text-emerald-700' : blePresent === false ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'}`}>
          {blePresent === true ? `BLE connecté${b.ble_rssi != null ? ` (${b.ble_rssi} dBm ≈ ${rssiToMeters(b.ble_rssi)} m)` : ''}`
           : blePresent === false ? 'BLE absent'
           : 'BLE inconnu'}
        </span>
      )}
      <span className={`${chip} ${b.alarm_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
        {b.alarm_enabled ? 'Alarme ON' : 'Alarme OFF'}
      </span>
      <span className={`${chip} bg-blue-100 text-blue-700`}>{MODE_LABEL[mode]}</span>
      {(mode === 'BLE' || mode === 'BOTH') && bleM != null && (
        <span className={`${chip} bg-indigo-100 text-indigo-700`}>Seuil BLE ≈ {bleM} m ({b.min_rssi} dBm)</span>
      )}
      {(mode === 'GPS' || mode === 'BOTH') && (
        <span className={`${chip} bg-indigo-100 text-indigo-700`}>Rayon GPS {b.max_distance_m ?? 50} m</span>
      )}
      <span className={`${chip} bg-amber-100 text-amber-700`}>Grâce {b.grace_minutes ?? 0} min</span>
      <span className={`${chip} bg-gray-100 text-gray-600`}>
        {b.active_start && b.active_end ? `${b.active_start}–${b.active_end}` : '24/7'}
      </span>
      {b.notify_exit && <span className={`${chip} bg-gray-100 text-gray-600`}>SMS sortie</span>}
      <span className={`${chip} ${ageM == null || ageM >= 12 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
        Pile {ageM == null ? 'non suivie' : `${ageM} mois`}
      </span>
    </div>
  );
}

// BLE beacon inventory: register, link to a bracelet, swap/unlink, mark faulty.
export default function BeaconsManager({ devices }: { devices: DeviceOpt[] }) {
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [uid, setUid] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cfgOpen, setCfgOpen] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  type Sighting = { name: string; mac: string; rssi: number };
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; stale: boolean; reason: string; sightings: Sighting[] }>>({});

  async function testBeacon(id: string) {
    setTesting(id);
    setTestResult((p) => { const n = { ...p }; delete n[id]; return n; });
    try {
      const r = await fetch('/api/beacons/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ beaconId: id }) });
      const d = await r.json();
      setTestResult((p) => ({ ...p, [id]: {
        ok: Boolean(r.ok && d.strongEnough),
        stale: Boolean(d.stale),
        reason: d.error ?? d.reason ?? '',
        sightings: Array.isArray(d.sightings) ? d.sightings : [],
      } }));
    } catch {
      setTestResult((p) => ({ ...p, [id]: { ok: false, stale: false, reason: 'Erreur réseau', sightings: [] } }));
    } finally { setTesting(null); }
  }

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/beacons', { cache: 'no-store' });
      const d = await r.json();
      setBeacons(Array.isArray(d.beacons) ? d.beacons : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    // Async loader — setBeacons runs after an awaited fetch, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Auto-refresh the live BLE status (distance/RSSI, present/absent) every 20s
    // so it tracks each scan without the operator reloading the page.
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

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
        <button onClick={register} disabled={busy} data-tip="Enregistrer une nouvelle balise BLE domicile (UID + libellé)" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40">
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
                <Fragment key={b.id}>
                <tr className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-mono text-xs text-gray-700 align-top">
                    {b.uid}
                    <BeaconActiveParams b={b} />
                  </td>
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
                        <button onClick={() => post('/api/beacons/link', { beaconId: b.id, deviceId: null })} data-tip="Délier cette balise du bracelet" className="p-1 text-gray-500 hover:text-red-600">
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {b.status !== 'FAULTY' ? (
                        <button onClick={() => post('/api/beacons/status', { beaconId: b.id, status: 'FAULTY' })} data-tip="Marquer la balise comme défaillante (retirée du service)" className="p-1 text-gray-500 hover:text-red-600">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => post('/api/beacons/status', { beaconId: b.id, status: 'SPARE' })} data-tip="Remettre la balise en service (disponible)" className="p-1 text-gray-500 hover:text-green-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => setCfgOpen(cfgOpen === b.id ? null : b.id)} data-tip="Options d'alarme domicile : distance max, délai de grâce, horaires, notifications" className={`p-1 ${cfgOpen === b.id ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}>
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                      {b.device_id && (
                        <button onClick={() => testBeacon(b.id)} disabled={testing === b.id} data-tip="Demander au bracelet lié de scanner en BLE et confirmer que cette balise est réellement détectée" className="p-1 text-gray-500 hover:text-indigo-600 disabled:opacity-50">
                          {testing === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radar className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                    {testResult[b.id] && (
                      <div className="mt-1">
                        <p className={`text-[10px] ${testResult[b.id].ok ? 'text-emerald-600' : testResult[b.id].stale ? 'text-amber-600' : 'text-red-600'}`}>
                          {testResult[b.id].ok ? '✓ ' : testResult[b.id].stale ? '⚠ ' : '✗ '}{testResult[b.id].reason}
                        </p>
                        {testResult[b.id].sightings.length > 0 && (
                          <div className="mt-1 text-[10px] text-gray-500">
                            <span className="font-semibold">Vu par le bracelet ({testResult[b.id].sightings.length}) :</span>
                            <ul className="mt-0.5 space-y-0.5">
                              {testResult[b.id].sightings.map((s) => (
                                <li key={s.mac} className={s.mac === (b.uid ?? '').toUpperCase() ? 'text-indigo-600 font-medium' : ''}>
                                  {s.mac === (b.uid ?? '').toUpperCase() ? '★ ' : '• '}
                                  <span className="font-mono">{s.mac}</span> {s.name && `(${s.name})`} — {s.rssi} dBm ≈ {rssiToMeters(s.rssi)} m
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                {cfgOpen === b.id && (
                  <tr className="bg-gray-50/60">
                    <td colSpan={5} className="px-5 py-3">
                      <BeaconConfigForm beacon={b} onSave={(p) => post('/api/beacons/config', { beaconId: b.id, ...p })} />
                    </td>
                  </tr>
                )}
                </Fragment>
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

interface ConfigPayload {
  alarmEnabled: boolean; alarmMode: 'GPS' | 'BLE' | 'BOTH'; maxDistanceM: number; graceMinutes: number;
  notifyExit: boolean; activeStart: string | null; activeEnd: string | null;
  setHomeFromDevice?: boolean; minRssi: number; batteryChanged?: boolean;
}

// Coin-cell life warning threshold (months) for the passive home beacon.
function batteryAgeMonths(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (30 * 86400000));
}

// BLE proximity ↔ RSSI, log-distance path-loss model (TxPower -59 dBm @1m,
// path-loss exponent 2.5 for indoor). Lets the operator think in metres while
// the device/enforcement works in RSSI dBm.
const TX_POWER = -59;
const PATH_LOSS = 2.5;
function metersToRssi(m: number): number {
  const d = Math.max(0.5, m);
  return Math.round(TX_POWER - 10 * PATH_LOSS * Math.log10(d));
}
function rssiToMeters(rssi: number): number {
  const d = Math.pow(10, (TX_POWER - rssi) / (10 * PATH_LOSS));
  return Math.round(d * 10) / 10;
}

function BeaconConfigForm({ beacon, onSave }: { beacon: Beacon; onSave: (p: ConfigPayload) => Promise<boolean> }) {
  const [alarmEnabled, setAlarm] = useState(beacon.alarm_enabled ?? true);
  const [alarmMode, setMode] = useState<'GPS' | 'BLE' | 'BOTH'>(beacon.alarm_mode ?? 'BOTH');
  const [maxDistanceM, setDist] = useState(beacon.max_distance_m ?? 50);
  const [graceMinutes, setGrace] = useState(beacon.grace_minutes ?? 5);
  const [notifyExit, setNotify] = useState(beacon.notify_exit ?? true);
  const [activeStart, setStart] = useState(beacon.active_start ?? '');
  const [activeEnd, setEnd] = useState(beacon.active_end ?? '');
  const [setHome, setSetHome] = useState(false);
  const [minRssi, setMinRssi] = useState(beacon.min_rssi ?? -85);
  // BLE proximity expressed in metres (derived from the RSSI threshold).
  const [bleMeters, setBleMeters] = useState(rssiToMeters(beacon.min_rssi ?? -85));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const homeSet = beacon.home_lat != null && beacon.home_lng != null;

  async function save() {
    setSaving(true); setSaved(false);
    const ok = await onSave({ alarmEnabled, alarmMode, maxDistanceM: Number(maxDistanceM), graceMinutes: Number(graceMinutes), notifyExit, activeStart: activeStart || null, activeEnd: activeEnd || null, setHomeFromDevice: setHome, minRssi: Number(minRssi) });
    setSaving(false); setSaved(ok);
  }

  const FIELD = 'border border-gray-300 rounded px-2 py-1 text-xs';
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex items-center gap-1.5 text-xs text-gray-700">
        <input type="checkbox" checked={alarmEnabled} onChange={(e) => setAlarm(e.target.checked)} /> Alarme activée
      </label>
      <div>
        <label className="block text-[11px] text-gray-500 mb-0.5" title="BLE = proximité balise seule (sans géofence). GPS = rayon domicile. Les deux = GPS avec suppression BLE.">Mode d&apos;alarme</label>
        <select value={alarmMode} onChange={(e) => setMode(e.target.value as 'GPS' | 'BLE' | 'BOTH')} className={FIELD}>
          <option value="BLE">Proximité BLE (sans géofence)</option>
          <option value="GPS">Rayon domicile GPS</option>
          <option value="BOTH">Les deux (GPS + BLE)</option>
        </select>
      </div>
      {alarmMode !== 'BLE' && (
        <div>
          <label className="block text-[11px] text-gray-500 mb-0.5">Distance max alarme GPS (m)</label>
          <input type="number" min={5} max={5000} value={maxDistanceM} onChange={(e) => setDist(Number(e.target.value))} className={FIELD + ' w-24'} />
        </div>
      )}
      <div>
        <label className="block text-[11px] text-gray-500 mb-0.5">Délai de grâce (min)</label>
        <input type="number" min={0} max={120} value={graceMinutes} onChange={(e) => setGrace(Number(e.target.value))} className={FIELD + ' w-20'} />
      </div>
      <div>
        <label className="block text-[11px] text-gray-500 mb-0.5" title="Distance maximale entre le bracelet et la balise domicile pour être considéré 'à domicile'. Au-delà (beacon trop faible/absent), le sujet est jugé hors domicile → alarme après le délai de grâce.">
          Distance BLE domicile (m)
        </label>
        <input
          type="number" min={1} max={50} step={1} value={bleMeters}
          onChange={(e) => { const m = Number(e.target.value); setBleMeters(m); setMinRssi(metersToRssi(m)); }}
          className={FIELD + ' w-24'}
        />
        <p className="text-[9px] text-gray-400 mt-0.5">≈ seuil {minRssi} dBm</p>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-gray-700">
        <input type="checkbox" checked={notifyExit} onChange={(e) => setNotify(e.target.checked)} /> Notifier sortie
      </label>
      <div>
        <label className="block text-[11px] text-gray-500 mb-0.5">Actif de</label>
        <input type="time" value={activeStart} onChange={(e) => setStart(e.target.value)} className={FIELD} />
      </div>
      <div>
        <label className="block text-[11px] text-gray-500 mb-0.5">à</label>
        <input type="time" value={activeEnd} onChange={(e) => setEnd(e.target.value)} className={FIELD} />
      </div>
      <label className="flex items-center gap-1.5 text-xs text-gray-700" title="Capture la position actuelle du bracelet comme domicile de référence">
        <input type="checkbox" checked={setHome} onChange={(e) => setSetHome(e.target.checked)} /> Domicile = position actuelle
      </label>
      <button onClick={save} disabled={saving} data-tip="Enregistrer les options d'alarme domicile de cette balise" className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold disabled:opacity-40">
        {saving ? '…' : 'Enregistrer options'}
      </button>
      {alarmMode !== 'BLE' && (
        <span className={`text-xs ${homeSet ? 'text-emerald-600' : 'text-amber-600'}`}>
          {homeSet ? 'Domicile défini ✓' : 'Domicile non défini'}
        </span>
      )}
      {alarmMode === 'BLE' && (
        <span className="text-xs text-blue-600">Mode BLE : aucune géofence requise</span>
      )}
      {/* Passive beacon battery tracking */}
      <div className="flex items-center gap-1.5">
        {(() => {
          const age = batteryAgeMonths(beacon.battery_changed_at);
          const warn = age === null || age >= 12;
          return (
            <>
              <span className={`text-[11px] ${warn ? 'text-amber-600' : 'text-gray-400'}`}>
                Pile : {age === null ? 'non suivie' : `${age} mois`}
              </span>
              <button type="button" onClick={() => onSave({ alarmEnabled, alarmMode, maxDistanceM: Number(maxDistanceM), graceMinutes: Number(graceMinutes), notifyExit, activeStart: activeStart || null, activeEnd: activeEnd || null, minRssi: Number(minRssi), batteryChanged: true })}
                className="text-[11px] px-2 py-0.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">
                Pile remplacée
              </button>
            </>
          );
        })()}
      </div>
      {saved && <span className="text-xs text-emerald-600">Enregistré ✓</span>}
    </div>
  );
}
