import { redirect } from 'next/navigation';
import { CheckCircle2, AlertTriangle, XCircle, MapPin, RefreshCw } from 'lucide-react';
import type { SyncStatus } from '@/lib/supabase/types';
import { getSession } from '@/lib/auth/session';
import { canViewDevices, canConfigureHardware , allow } from '@/lib/auth/permissions';
import { fetchAllDevices, fetchCases } from '@/lib/mock/helpers';
import RegisterDeviceForm from '@/components/devices/RegisterDeviceForm';
import BeaconsManager from '@/components/devices/BeaconsManager';
import DeviceInventory, { type DeviceRow } from '@/components/devices/DeviceInventory';
import AutoRefresh from '@/components/common/AutoRefresh';

export const metadata = { title: 'Bracelets & Balises BLE — SIGEP' };
export const revalidate = 0;

const ALERT_SHORT: Record<string, string> = {
  TAMPER_DETECTED: 'Sabotage', PANIC_BUTTON: 'Panique', GEOFENCE_EXIT: 'Sortie zone',
  BLE_EXIT: 'Sortie domicile', CURFEW_VIOLATION: 'Couvre-feu', HEALTH_CRITICAL: 'Santé',
  SIGNAL_LOST: 'Signal', BATTERY_LOW: 'Batterie',
};

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

  // Real telemetry (real mode): replace mock-only display columns with live data.
  // - GPS accuracy from each device's latest position fix (positions.accuracy_m).
  // - Geofences "synced" = count of active zones on the assigned case.
  const accuracyByDevice = new Map<string, number>();
  const geofenceCountByCase = new Map<string, number>();
  const alertsByDevice = new Map<string, { count: number; top: string | null; topSev: number }>();
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (sb) {
      const deviceIds = devices.map((d) => d.id);
      if (deviceIds.length) {
        const { data: pos } = await sb
          .from('positions')
          .select('device_id, accuracy_m, recorded_at')
          .in('device_id', deviceIds)
          .order('recorded_at', { ascending: false })
          .limit(2000);
        for (const p of (pos ?? []) as { device_id: string; accuracy_m: number | null }[]) {
          if (p.device_id && !accuracyByDevice.has(p.device_id) && p.accuracy_m != null) {
            accuracyByDevice.set(p.device_id, p.accuracy_m);
          }
        }
        const { data: al } = await sb
          .from('alerts')
          .select('device_id, alert_type, severity')
          .eq('is_resolved', false)
          .in('device_id', deviceIds);
        for (const a of (al ?? []) as { device_id: string | null; alert_type: string; severity: number | null }[]) {
          if (!a.device_id) continue;
          const cur = alertsByDevice.get(a.device_id) ?? { count: 0, top: null, topSev: -1 };
          cur.count += 1;
          if ((a.severity ?? 0) > cur.topSev) { cur.topSev = a.severity ?? 0; cur.top = ALERT_SHORT[a.alert_type] ?? a.alert_type; }
          alertsByDevice.set(a.device_id, cur);
        }
      }
      const caseIds = devices.map((d) => d.case_id).filter(Boolean) as string[];
      if (caseIds.length) {
        const { data: gz } = await sb.from('geofences').select('case_id, status').in('case_id', caseIds);
        for (const g of (gz ?? []) as { case_id: string; status?: string }[]) {
          if (g.status === 'REQUESTED') continue;
          geofenceCountByCase.set(g.case_id, (geofenceCountByCase.get(g.case_id) ?? 0) + 1);
        }
      }
    }
  }

  const online    = devices.filter((d) => d.is_online).length;
  const unassigned = devices.filter((d) => !d.case_id).length;
  const lowBattery = devices.filter((d) => (d.battery_pct ?? 100) < 20).length;
  // Server Component renders once per request — Date.now() is deterministic here.
  // eslint-disable-next-line react-hooks/purity
  const staleContact = devices.filter((d) => d.last_seen_at && (Date.now() - new Date(d.last_seen_at).getTime()) > 86400000).length;
  const simSuspended = devices.filter((d) => d.sim_status === 'SUSPENDED').length;

  // Serializable rows for the interactive inventory (search / filter / sort).
  const deviceRows: DeviceRow[] = devices.map((d) => {
    const c = d.case_id ? caseMap.get(d.case_id) : undefined;
    const al = alertsByDevice.get(d.id);
    return {
      id: d.id, imei: d.imei, model: d.model ?? null, is_online: d.is_online,
      worn: d.worn ?? null, battery: d.battery_pct ?? null,
      sim_number: d.sim_number ?? null, sim_carrier: d.sim_carrier ?? null,
      sim_activated_at: d.sim_activated_at ?? null, sim_status: d.sim_status ?? null,
      ble_high_avail: d.ble_high_avail ?? false, last_seen_at: d.last_seen_at ?? null,
      case_id: d.case_id ?? null, case_number: c?.case_number ?? null,
      case_name: c?.individual?.full_name ?? null,
      lifecycle: (d.lifecycle_status as DeviceRow['lifecycle']) ?? (d.case_id ? 'ACTIVE' : 'STOCK'),
      signal_dbm: d.signal_strength_dbm ?? null,
      open_alerts: al?.count ?? 0,
      alert_top: al?.top ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <AutoRefresh />
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

      {/* Device inventory — search / filter / sort */}
      <DeviceInventory rows={deviceRows} isHardwareAdmin={isHardwareAdmin} />

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

                {/* GPS accuracy — from the device's latest real position fix */}
                <div>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Précision GPS</p>
                  {(() => {
                    const acc = accuracyByDevice.get(d.id) ?? d.gps_accuracy_m;
                    return (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span className="text-[10px] font-semibold text-gray-700">
                          {acc != null ? `±${Math.round(acc)} m` : '—'}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Heartbeat */}
                <div>
                  <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1">Dernier heartbeat</p>
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${d.last_heartbeat_at ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'}`} />
                    <span className="text-[10px] text-gray-600">{heartbeatAgo(d.last_heartbeat_at)}</span>
                  </div>
                  {(() => {
                    const gz = d.case_id ? (geofenceCountByCase.get(d.case_id) ?? d.geofences_synced) : d.geofences_synced;
                    return gz != null ? (
                      <p className="text-[9px] text-gray-400 mt-0.5">{gz} géofence{gz !== 1 ? 's' : ''} active{gz !== 1 ? 's' : ''}</p>
                    ) : null;
                  })()}
                </div>
              </div>
            );
          })}

          {devices.filter((d) => d.case_id).length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Aucun dispositif assigné</p>
          )}

        </div>
      </div>

    </div>
  );
}
