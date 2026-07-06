import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Wifi, WifiOff, Battery, Signal, MapPin, Clock, Radio,
  PersonStanding, ShieldOff, Bluetooth, FolderOpen, Tag, ClipboardList, CheckCircle2, AlertTriangle, XCircle,
} from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { canViewDevices, canConfigureHardware, allow } from '@/lib/auth/permissions';
import { fetchAllDevices } from '@/lib/mock/helpers';
import type { SyncStatus } from '@/lib/supabase/types';
import { LIFECYCLE_STYLE, LIFECYCLE_LABEL } from '@/components/devices/DeviceInventory';
import AssignDeviceControl from '@/components/devices/AssignDeviceControl';
import DeleteDeviceButton from '@/components/devices/DeleteDeviceButton';
import DeviceLifecycleButton from '@/components/devices/DeviceLifecycleButton';
import DeviceCommandButtons from '@/components/devices/DeviceCommandButtons';
import TestConnectionButton from '@/components/devices/TestConnectionButton';
import ProvisionButton from '@/components/devices/ProvisionButton';
import BleScanButton from '@/components/devices/BleScanButton';
import BleHighAvailButton from '@/components/devices/BleHighAvailButton';
import MiniPositionMap from '@/components/devices/MiniPositionMapLoader';
import AutoRefresh from '@/components/common/AutoRefresh';

// Tiny inline SVG sparkline (no chart lib → CSP-safe). Oldest→newest left→right.
function Sparkline({ values, color, min, max }: { values: number[]; color: string; min?: number; max?: number }) {
  if (values.length < 2) return <span className="text-xs text-gray-400">Données insuffisantes</span>;
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const w = 160, h = 36;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - lo) / span) * h}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export const metadata = { title: 'Détail bracelet — SIGEP' };
export const dynamic = 'force-dynamic';

interface Pos { latitude: number; longitude: number; accuracy_m: number | null; speed_kmh: number | null; recorded_at: string }
interface Evt { id: string; event_type: string; detail: string | null; created_at: string }

function ago(iso: string | null): string {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
}

const EVENT_LABEL: Record<string, string> = {
  ONLINE: 'Reprise contact', OFFLINE: 'Perte contact', COMMAND: 'Commande', RESTART: 'Redémarrage',
  TAMPER: 'Sabotage', LOW_BATTERY: 'Batterie faible', SIM_CHANGE: 'SIM modifiée', ASSIGN: 'Assignation',
};

export default async function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || !allow(session, canViewDevices(session.role), 'hardware')) redirect('/sigep/dashboard');
  const isHardwareAdmin = canConfigureHardware(session.role);

  const devices = await fetchAllDevices();
  const d = devices.find((x) => x.id === id);
  if (!d) notFound();

  // Real telemetry: latest position, recent positions, recent events, linked beacon.
  let latest: Pos | null = null;
  let recentPos: Pos[] = [];
  let events: Evt[] = [];
  let beacon: { uid: string; label: string | null; ble_present: boolean | null } | null = null;
  let caseInfo: { case_number: string; name: string | null } | null = null;
  let telemetry: { battery_pct: number | null; signal_dbm: number | null; recorded_at: string }[] = [];
  let openAlerts: { alert_type: string; severity: number | null }[] = [];

  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (sb) {
      const [{ data: pos }, { data: ev }, { data: bc }, { data: tel }, { data: al }] = await Promise.all([
        sb.from('positions').select('latitude, longitude, accuracy_m, speed_kmh, recorded_at').eq('device_id', id).order('recorded_at', { ascending: false }).limit(10),
        sb.from('device_events').select('id, event_type, detail, created_at').eq('device_id', id).order('created_at', { ascending: false }).limit(15),
        sb.from('beacons').select('uid, label, ble_present').eq('device_id', id).maybeSingle(),
        sb.from('device_telemetry').select('battery_pct, signal_dbm, recorded_at').eq('device_id', id).order('recorded_at', { ascending: false }).limit(60),
        sb.from('alerts').select('alert_type, severity, case_id').eq('device_id', id).eq('is_resolved', false),
      ]);
      recentPos = (pos ?? []) as Pos[];
      latest = recentPos[0] ?? null;
      events = (ev ?? []) as Evt[];
      beacon = (bc as unknown as { uid: string; label: string | null; ble_present: boolean | null } | null) ?? null;
      telemetry = ((tel ?? []) as typeof telemetry).slice().reverse(); // oldest → newest for the chart
      // Scope to the device's current case so a reassigned bracelet doesn't show
      // the previous wearer's open alerts.
      openAlerts = ((al ?? []) as (typeof openAlerts[number] & { case_id: string | null })[])
        .filter((a) => a.case_id === (d.case_id ?? null));
      if (d.case_id) {
        const { data: c } = await sb.from('cases').select('case_number, individual:individuals(full_name)').eq('id', d.case_id).maybeSingle();
        const row = c as { case_number?: string; individual?: { full_name?: string } | null } | null;
        if (row?.case_number) caseInfo = { case_number: row.case_number, name: row.individual?.full_name ?? null };
      }
    }
  }

  const bat = d.battery_pct ?? 0;
  const dbm = d.signal_strength_dbm;
  const acc = latest?.accuracy_m ?? d.gps_accuracy_m ?? null;
  const lifecycle = (d.lifecycle_status as 'STOCK' | 'ACTIVE' | 'MAINTENANCE' | 'RETIRED') ?? (d.case_id ? 'ACTIVE' : 'STOCK');
  const batSeries = telemetry.map((t) => t.battery_pct).filter((x): x is number => x != null);
  const sigSeries = telemetry.map((t) => t.signal_dbm).filter((x): x is number => x != null);
  const topAlert = openAlerts.slice().sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))[0] ?? null;

  const syncStyle: Record<NonNullable<SyncStatus>, string> = {
    SYNCED: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    DELAYED: 'text-amber-700 bg-amber-50 border-amber-100',
    LOST: 'text-red-700 bg-red-50 border-red-100',
  };
  const syncIcon = { SYNCED: <CheckCircle2 className="w-4 h-4" />, DELAYED: <AlertTriangle className="w-4 h-4" />, LOST: <XCircle className="w-4 h-4" /> };
  const syncLabel: Record<NonNullable<SyncStatus>, string> = { SYNCED: 'Synchronisé', DELAYED: 'Retard', LOST: 'Perdu' };

  const card = 'bg-white rounded-2xl border border-gray-100 p-4';

  return (
    <div className="space-y-5">
      <AutoRefresh />
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href="/sigep/dashboard/devices" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1">
            <ArrowLeft className="w-4 h-4" /> Retour à l&apos;inventaire
          </Link>
          <h2 className="text-xl font-bold text-gray-900 font-mono">{d.imei}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{d.model ?? 'Bracelet'} · créé le {new Date(d.created_at).toLocaleDateString('fr-FR')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border ${d.is_online ? 'text-green-700 bg-green-50 border-green-100' : 'text-gray-500 bg-gray-50 border-gray-100'}`}>
            {d.is_online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />} {d.is_online ? 'En ligne' : 'Hors ligne'}
          </span>
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border ${d.worn === true ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : d.worn === false ? 'text-red-700 bg-red-50 border-red-100' : 'text-gray-400 bg-gray-50 border-gray-100'}`}>
            {d.worn === true ? <PersonStanding className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />} {d.worn === true ? 'Porté' : d.worn === false ? 'Retiré' : 'Port inconnu'}
          </span>
          <span className={`inline-flex items-center text-sm font-medium px-3 py-1.5 rounded-lg ${LIFECYCLE_STYLE[lifecycle]}`}>{LIFECYCLE_LABEL[lifecycle]}</span>
          {openAlerts.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-red-100 text-red-700">
              <AlertTriangle className="w-4 h-4" /> {openAlerts.length} alerte{openAlerts.length > 1 ? 's' : ''}{topAlert ? ` · ${topAlert.alert_type}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Telemetry cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className={card}>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Battery className="w-3 h-3" /> Batterie</p>
          <p className={`text-lg font-bold ${bat < 20 ? 'text-red-600' : 'text-gray-800'}`}>{bat}%</p>
        </div>
        <div className={card}>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Signal className="w-3 h-3" /> Signal GSM</p>
          <p className="text-lg font-bold text-gray-800">{dbm != null ? `${dbm} dBm` : '—'}</p>
        </div>
        <div className={card}>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Précision GPS</p>
          <p className="text-lg font-bold text-gray-800">{acc != null ? `±${Math.round(acc)} m` : '—'}</p>
        </div>
        <div className={card}>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Sync GPS</p>
          {d.sync_status ? (
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg border ${syncStyle[d.sync_status]}`}>{syncIcon[d.sync_status]} {syncLabel[d.sync_status]}</span>
          ) : <p className="text-sm text-gray-400">—</p>}
        </div>
        <div className={card}>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Dernier contact</p>
          <p className="text-lg font-bold text-gray-800">{d.last_seen_at ? `il y a ${ago(d.last_seen_at)}` : '—'}</p>
        </div>
        <div className={card}>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Radio className="w-3 h-3" /> Heartbeat</p>
          <p className="text-lg font-bold text-gray-800">{d.last_heartbeat_at ? `il y a ${ago(d.last_heartbeat_at)}` : '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: assignment + position + beacon */}
        <div className="lg:col-span-1 space-y-5">
          <div className={card}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><FolderOpen className="w-4 h-4 text-gray-400" /> Affectation</h3>
            {caseInfo || d.case_id ? (
              <div className="space-y-1">
                <Link href={`/sigep/dashboard/cases/${d.case_id}`} className="font-mono text-sm text-blue-700 hover:underline">{caseInfo?.case_number ?? d.case_id}</Link>
                {caseInfo?.name && <p className="text-sm text-gray-600">{caseInfo.name}</p>}
                {d.assigned_at && <p className="text-xs text-gray-400">Assigné le {new Date(d.assigned_at).toLocaleDateString('fr-FR')}</p>}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Disponible</span>
                {isHardwareAdmin && <AssignDeviceControl deviceId={d.id} />}
              </div>
            )}
          </div>

          <div className={card}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /> Dernière position</h3>
            {latest ? (
              <div className="space-y-2 text-sm">
                <div className="h-40 rounded-xl overflow-hidden border border-gray-100">
                  <MiniPositionMap lat={latest.latitude} lng={latest.longitude} label={caseInfo?.name ?? d.imei} />
                </div>
                <p className="font-mono text-gray-700">{latest.latitude.toFixed(5)}, {latest.longitude.toFixed(5)}</p>
                <p className="text-xs text-gray-500">Précision ±{latest.accuracy_m != null ? Math.round(latest.accuracy_m) : '?'} m · {latest.speed_kmh != null ? `${latest.speed_kmh.toFixed(1)} km/h` : '—'} · {ago(latest.recorded_at)}</p>
                <div className="flex gap-2 pt-1">
                  <a href={`https://www.google.com/maps?q=${latest.latitude},${latest.longitude}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Google Maps ↗</a>
                  {d.case_id && <Link href={`/sigep/dashboard/cases/${d.case_id}/history`} className="text-xs text-violet-600 hover:underline">Itinéraire ↗</Link>}
                </div>
              </div>
            ) : <p className="text-sm text-gray-400">Aucune position enregistrée.</p>}
          </div>

          <div className={card}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Bluetooth className="w-4 h-4 text-blue-600" /> Balise domicile</h3>
            {beacon ? (
              <div className="text-sm">
                <p className="font-mono text-gray-700">{beacon.uid}</p>
                {beacon.label && <p className="text-xs text-gray-500">{beacon.label}</p>}
                <span className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded ${beacon.ble_present === true ? 'bg-emerald-100 text-emerald-700' : beacon.ble_present === false ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                  {beacon.ble_present === true ? 'BLE connecté' : beacon.ble_present === false ? 'BLE absent' : 'BLE inconnu'}
                </span>
              </div>
            ) : <p className="text-sm text-gray-400">Aucune balise liée.</p>}
          </div>
        </div>

        {/* Right: controls + events + recent positions */}
        <div className="lg:col-span-2 space-y-5">
          {isHardwareAdmin && (
            <div className={card}>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Commandes & maintenance</h3>
              <div className="flex items-center gap-4 flex-wrap">
                <TestConnectionButton imei={d.imei} />
                {(d.case_id || d.last_seen_at || d.is_online) && <DeviceCommandButtons imei={d.imei} />}
                <BleScanButton imei={d.imei} />
                <BleHighAvailButton imei={d.imei} active={d.ble_high_avail ?? false} />
                <ProvisionButton imei={d.imei} />
                <Link href={`/sigep/dashboard/devices/${d.id}/label`} target="_blank" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"><Tag className="w-3.5 h-3.5" /> Étiquette</Link>
                <Link href={`/sigep/dashboard/devices/${d.id}/events`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><ClipboardList className="w-3.5 h-3.5" /> Journal complet</Link>
                <DeviceLifecycleButton deviceId={d.id} imei={d.imei} lifecycle={lifecycle} assigned={!!d.case_id} />
                {!d.case_id && <DeleteDeviceButton deviceId={d.id} imei={d.imei} />}
              </div>
            </div>
          )}

          <div className={card}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Tendances (batterie & signal)</h3>
            {telemetry.length < 2 ? (
              <p className="text-sm text-gray-400">Historique insuffisant — les tendances apparaissent après quelques relevés.</p>
            ) : (
              <>
              <p className="text-[10px] text-gray-400 mb-2">
                {telemetry.length} relevés · du {new Date(telemetry[0].recorded_at).toLocaleString('fr-FR', { timeZone: 'Africa/Ouagadougou', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                {' au '}{new Date(telemetry[telemetry.length - 1].recorded_at).toLocaleString('fr-FR', { timeZone: 'Africa/Ouagadougou', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Battery className="w-3.5 h-3.5" /> Batterie</span>
                    <span className="text-xs font-semibold text-gray-700">{batSeries[batSeries.length - 1] ?? '—'}%</span>
                  </div>
                  <Sparkline values={batSeries} color="#10b981" min={0} max={100} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Signal className="w-3.5 h-3.5" /> Signal GSM</span>
                    <span className="text-xs font-semibold text-gray-700">{sigSeries[sigSeries.length - 1] ?? '—'} dBm</span>
                  </div>
                  <Sparkline values={sigSeries} color="#3b82f6" />
                </div>
              </div>
              </>
            )}
          </div>

          <div className={card}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Événements récents</h3>
            {events.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun événement enregistré.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {events.map((e) => (
                  <li key={e.id} className="py-2 flex items-center gap-3 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                    <span className="font-medium text-gray-700">{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                    <span className="flex-1 min-w-0 truncate text-xs text-gray-400">{e.detail ?? ''}</span>
                    <span className="text-[11px] text-gray-400 flex-shrink-0">il y a {ago(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={card}>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Positions récentes</h3>
            {recentPos.length === 0 ? (
              <p className="text-sm text-gray-400">Aucune position.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-400 text-left"><th className="py-1.5 font-medium">Horodatage</th><th className="font-medium">Coordonnées</th><th className="font-medium">Précision</th><th className="font-medium">Vitesse</th></tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentPos.map((p, i) => (
                      <tr key={i} className="text-gray-600">
                        <td className="py-1.5">{new Date(p.recorded_at).toLocaleString('fr-FR', { timeZone: 'Africa/Ouagadougou' })}</td>
                        <td className="font-mono">{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</td>
                        <td>{p.accuracy_m != null ? `±${Math.round(p.accuracy_m)} m` : '—'}</td>
                        <td>{p.speed_kmh != null ? `${p.speed_kmh.toFixed(1)} km/h` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
