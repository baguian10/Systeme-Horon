import { redirect } from 'next/navigation';
import {
  Wifi, WifiOff, Battery, Package, Timer,
  CheckCircle2, AlertTriangle, XCircle, MapPin, RefreshCw, Fingerprint, Tag, ClipboardList,
  PersonStanding, ShieldOff,
} from 'lucide-react';
import Link from 'next/link';
import type { SyncStatus } from '@/lib/supabase/types';
import { getSession } from '@/lib/auth/session';
import { canViewDevices, canConfigureHardware , allow } from '@/lib/auth/permissions';
import { fetchAllDevices, fetchCases } from '@/lib/mock/helpers';
import AssignDeviceControl from '@/components/devices/AssignDeviceControl';
import SimPanel from '@/components/devices/SimPanel';
import RegisterDeviceForm from '@/components/devices/RegisterDeviceForm';
import BeaconsManager from '@/components/devices/BeaconsManager';
import TestConnectionButton from '@/components/devices/TestConnectionButton';
import ProvisionButton from '@/components/devices/ProvisionButton';
import BleScanButton from '@/components/devices/BleScanButton';
import BleHighAvailButton from '@/components/devices/BleHighAvailButton';

export const metadata = { title: 'Bracelets & Balises BLE — SIGEP' };
export const revalidate = 0;

export default async function DevicesPage() {
  const session = await getSession();
  if (!session || !allow(session, canViewDevices(session.role), 'hardware')) redirect('/sigep/dashboard');

  const isHardwareAdmin = canConfigureHardware(session.role);

  const [devices, sessionCases] = await Promise.all([
    fetchAllDevices(),
    fetchCases(session.role, session.id),
  ]);

  // SUPER_ADMIN has no RLS read on cases → load them via the admin client so
  // assigned bracelets show their real case number.
  let cases = sessionCases;
  if (isHardwareAdmin && cases.length === 0 && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (sb) {
      const { data } = await sb.from('cases').select('*, individual:individuals(*)');
      if (data) cases = data as typeof cases;
    }
  }

  const caseMap = new Map(cases.map((c) => [c.id, c]));
  const online    = devices.filter((d) => d.is_online).length;
  const unassigned = devices.filter((d) => !d.case_id).length;
  const lowBattery = devices.filter((d) => (d.battery_pct ?? 100) < 20).length;
  // Server Component renders once per request — Date.now() is deterministic here.
  // eslint-disable-next-line react-hooks/purity
  const staleContact = devices.filter((d) => d.last_seen_at && (Date.now() - new Date(d.last_seen_at).getTime()) > 86400000).length;
  const simSuspended = devices.filter((d) => d.sim_status === 'SUSPENDED').length;

  function timeAgo(iso: string) {
    // Server Component renders once per request — Date.now() is deterministic here.
    // eslint-disable-next-line react-hooks/purity
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (d < 60) return `${d}s`;
    if (d < 3600) return `${Math.floor(d / 60)}min`;
    if (d < 86400) return `${Math.floor(d / 3600)}h`;
    return `${Math.floor(d / 86400)}j`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Inventaire des dispositifs</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {devices.length} bracelet{devices.length !== 1 ? 's' : ''} · {online} en ligne · {unassigned} non assigné{unassigned !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from an API route */}
          <a href="/api/export/devices" data-tip="Exporter tout le parc de bracelets (IMEI, état, batterie, SIM, dossier) en CSV" className="inline-flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 text-gray-700">
            ⬇️ Exporter CSV
          </a>
          {isHardwareAdmin && <RegisterDeviceForm />}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total',         value: devices.length,           color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-100' },
          { label: 'En ligne',      value: online,                   color: 'text-green-700',  bg: 'bg-green-50 border-green-100' },
          { label: 'Hors ligne',    value: devices.length - online,  color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-100' },
          { label: 'Batterie faible', value: lowBattery,             color: 'text-red-700',    bg: 'bg-red-50 border-red-100' },
          { label: 'Sans contact >24h', value: staleContact,         color: 'text-orange-700', bg: 'bg-orange-50 border-orange-100' },
          { label: 'Non assignés',  value: unassigned,               color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-100' },
          { label: 'SIM suspendues', value: simSuspended,            color: 'text-red-700',    bg: 'bg-red-50 border-red-100' },
        ].map((t) => (
          <div key={t.label} className={`${t.bg} border rounded-2xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${t.color}`}>{t.value}</p>
            <p className="text-xs text-gray-500 mt-1">{t.label}</p>
          </div>
        ))}
      </div>

      {/* Device table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Bracelets électroniques</h3>
        </div>
        {devices.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
            <Package className="w-5 h-5" />
            <span className="text-sm">Aucun bracelet enregistré</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">IMEI</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Modèle</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Batterie</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">N° SIM</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Firmware</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dossier assigné</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dernier contact</th>
                  {isHardwareAdmin && <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {devices.map((d) => {
                  const assignedCase = d.case_id ? caseMap.get(d.case_id) : undefined;
                  const bat = d.battery_pct ?? 0;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-700">{d.imei}</td>
                      <td className="px-5 py-3.5 text-xs text-gray-600">{d.model}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${d.is_online ? 'text-green-600' : 'text-gray-400'}`}>
                          {d.is_online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                          {d.is_online ? 'En ligne' : 'Hors ligne'}
                        </span>
                        <span
                          data-tip="Détection de port du bracelet (capteur peau)"
                          className={`mt-1 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            d.worn === true ? 'bg-emerald-50 text-emerald-700'
                            : d.worn === false ? 'bg-red-50 text-red-700'
                            : 'bg-gray-100 text-gray-400'}`}
                        >
                          {d.worn === true ? <><PersonStanding className="w-3 h-3" /> Porté</>
                           : d.worn === false ? <><ShieldOff className="w-3 h-3" /> Retiré</>
                           : <><PersonStanding className="w-3 h-3" /> Port inconnu</>}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${bat < 20 ? 'bg-red-400' : bat < 50 ? 'bg-amber-400' : 'bg-green-400'}`}
                              style={{ width: `${bat}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${bat < 20 ? 'text-red-600' : 'text-gray-600'}`}>
                            <Battery className="inline w-3 h-3 mr-0.5" />{bat}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <SimPanel
                          deviceId={d.id}
                          canEdit={isHardwareAdmin}
                          sim={{
                            sim_number: d.sim_number ?? null,
                            sim_carrier: d.sim_carrier ?? null,
                            sim_activated_at: d.sim_activated_at ?? null,
                            sim_status: d.sim_status ?? null,
                          }}
                        />
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400 font-mono">{d.firmware_ver ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        {assignedCase ? (
                          <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                            {assignedCase.case_number}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">Disponible</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">
                        {d.last_seen_at ? `il y a ${timeAgo(d.last_seen_at)}` : '—'}
                      </td>
                      {isHardwareAdmin && (
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3 flex-wrap">
                            {assignedCase ? (
                              <span className="text-xs text-gray-400">Assigné</span>
                            ) : (
                              <AssignDeviceControl deviceId={d.id} />
                            )}
                            <TestConnectionButton imei={d.imei} />
                            <BleScanButton imei={d.imei} />
                            <BleHighAvailButton imei={d.imei} active={d.ble_high_avail ?? false} />
                            <ProvisionButton imei={d.imei} />
                            <Link
                              href={`/sigep/dashboard/devices/${d.id}/label`}
                              target="_blank"
                              data-tip="Ouvrir l'étiquette imprimable du bracelet (QR de l'IMEI, format 70×40 mm)"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                            >
                              <Tag className="w-3.5 h-3.5" /> Étiquette
                            </Link>
                            <Link
                              href={`/sigep/dashboard/devices/${d.id}/events`}
                              data-tip="Journal d'événements du bracelet : connexions, commandes, redémarrages, SIM…"
                              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                            >
                              <ClipboardList className="w-3.5 h-3.5" /> Journal
                            </Link>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ BLE BEACONS ══════════════════════════════════════════════════════ */}
      {isHardwareAdmin && (
        <BeaconsManager devices={devices.map((d) => ({ id: d.id, imei: d.imei }))} />
      )}

      {/* ══ GPS REAL-TIME SYNC STATUS ════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-gray-700">Synchronisation GPS — Temps réel</h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Données live
          </div>
        </div>
        <div className="p-5 space-y-3">
          {devices.filter((d) => d.case_id).map((d) => {
            const assignedCase = d.case_id ? caseMap.get(d.case_id) : undefined;

            const syncColor: Record<NonNullable<SyncStatus>, string> = {
              SYNCED:  'text-emerald-600 bg-emerald-50 border-emerald-100',
              DELAYED: 'text-amber-600 bg-amber-50 border-amber-100',
              LOST:    'text-red-600 bg-red-50 border-red-100',
            };
            const syncIcon = {
              SYNCED:  <CheckCircle2 className="w-3.5 h-3.5" />,
              DELAYED: <AlertTriangle className="w-3.5 h-3.5" />,
              LOST:    <XCircle className="w-3.5 h-3.5" />,
            };
            const syncLabel: Record<NonNullable<SyncStatus>, string> = {
              SYNCED:  'Synchronisé',
              DELAYED: 'Retard détecté',
              LOST:    'Connexion perdue',
            };

            const dbm = d.signal_strength_dbm;
            const sigBars = dbm === null ? 0 : dbm > -65 ? 4 : dbm > -75 ? 3 : dbm > -90 ? 2 : 1;
            const sigColor = dbm === null ? 'text-gray-300' : dbm > -75 ? 'text-emerald-500' : dbm > -90 ? 'text-amber-500' : 'text-red-500';

            function heartbeatAgo(iso: string | null) {
              if (!iso) return '—';
              const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
              if (s < 60) return `${s}s`;
              if (s < 3600) return `${Math.floor(s / 60)}min`;
              return `${Math.floor(s / 3600)}h`;
            }

            return (
              <div key={d.id} className="border border-gray-100 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 items-center">

                {/* Device identity */}
                <div className="col-span-2 md:col-span-1">
                  <p className="font-mono text-xs font-bold text-gray-800">{d.imei.slice(-8)}</p>
                  {assignedCase && (
                    <span className="mt-0.5 inline-block text-[10px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                      {assignedCase.case_number}
                    </span>
                  )}
                </div>

                {/* Sync status badge */}
                <div>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Statut sync</p>
                  {d.sync_status ? (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border ${syncColor[d.sync_status]}`}>
                      {syncIcon[d.sync_status]}
                      {syncLabel[d.sync_status]}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">—</span>
                  )}
                </div>

                {/* Protocol & interval */}
                <div>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Protocole</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-mono">
                      {d.network_protocol ?? '—'}
                    </span>
                    {d.report_interval_s && (
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <Timer className="w-3 h-3" />{d.report_interval_s}s
                      </span>
                    )}
                  </div>
                </div>

                {/* Signal strength */}
                <div>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Signal GSM</p>
                  <div className="flex items-end gap-0.5">
                    {[1, 2, 3, 4].map((bar) => (
                      <div
                        key={bar}
                        className={`rounded-sm transition-colors ${bar <= sigBars ? sigColor.replace('text-', 'bg-') : 'bg-gray-200'}`}
                        style={{ width: 4, height: 4 + bar * 3 }}
                      />
                    ))}
                    {dbm !== null && (
                      <span className={`ml-1.5 text-[10px] font-mono font-semibold ${sigColor}`}>{dbm} dBm</span>
                    )}
                  </div>
                </div>

                {/* GPS accuracy */}
                <div>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Précision GPS</p>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    <span className="text-[10px] font-semibold text-gray-700">
                      {d.gps_accuracy_m !== null ? `±${d.gps_accuracy_m} m` : '—'}
                    </span>
                  </div>
                </div>

                {/* Heartbeat */}
                <div>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Dernier heartbeat</p>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${d.last_heartbeat_at ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'}`} />
                    <span className="text-[10px] text-gray-600">{heartbeatAgo(d.last_heartbeat_at)}</span>
                  </div>
                  {d.geofences_synced !== null && (
                    <p className="text-[9px] text-gray-400 mt-0.5">{d.geofences_synced} géofence{d.geofences_synced !== 1 ? 's' : ''} syncée{d.geofences_synced !== 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>
            );
          })}

          {devices.filter((d) => d.case_id).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Aucun dispositif assigné</p>
          )}

          {/* Server endpoint info */}
          {isHardwareAdmin && devices[0]?.server_endpoint && (
            <div className="mt-2 flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <Fingerprint className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Endpoint d&apos;ingestion MQTT</p>
                <p className="text-xs font-mono text-slate-700">{devices[0].server_endpoint}</p>
              </div>
              <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">TLS 1.3</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
