'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Wifi, WifiOff, Battery, Package, Search, Tag, ClipboardList, PersonStanding, ShieldOff, ArrowUpDown, AlertTriangle } from 'lucide-react';
import SimPanel from '@/components/devices/SimPanel';
import AssignDeviceControl from '@/components/devices/AssignDeviceControl';
import DeviceCommandButtons from '@/components/devices/DeviceCommandButtons';
import DeleteDeviceButton from '@/components/devices/DeleteDeviceButton';
import DeviceLifecycleButton from '@/components/devices/DeviceLifecycleButton';
import TestConnectionButton from '@/components/devices/TestConnectionButton';
import ProvisionButton from '@/components/devices/ProvisionButton';
import BleScanButton from '@/components/devices/BleScanButton';
import BleHighAvailButton from '@/components/devices/BleHighAvailButton';

export interface DeviceRow {
  id: string;
  imei: string;
  model: string | null;
  is_online: boolean;
  worn: boolean | null;
  battery: number | null;
  sim_number: string | null;
  sim_carrier: string | null;
  sim_activated_at: string | null;
  sim_status: string | null;
  ble_high_avail: boolean;
  last_seen_at: string | null;
  case_id: string | null;
  case_number: string | null;
  case_name: string | null;
  lifecycle: 'STOCK' | 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
  signal_dbm: number | null;
  open_alerts: number;
  alert_top: string | null;
}

export const LIFECYCLE_STYLE: Record<string, string> = {
  STOCK:       'bg-gray-100 text-gray-600',
  ACTIVE:      'bg-emerald-50 text-emerald-700',
  MAINTENANCE: 'bg-amber-50 text-amber-700',
  RETIRED:     'bg-red-50 text-red-700',
};
export const LIFECYCLE_LABEL: Record<string, string> = {
  STOCK: 'En stock', ACTIVE: 'En service', MAINTENANCE: 'Maintenance', RETIRED: 'Réformé',
};

type StatusFilter = 'all' | 'online' | 'offline';
type AssignFilter = 'all' | 'assigned' | 'available';
type SortKey = 'imei' | 'battery' | 'lastSeen' | 'status';

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
}

type LifeFilter = 'all' | 'STOCK' | 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';

export default function DeviceInventory({ rows, isHardwareAdmin }: { rows: DeviceRow[]; isHardwareAdmin: boolean }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [assign, setAssign] = useState<AssignFilter>('all');
  const [life, setLife] = useState<LifeFilter>('all');
  const [lowBat, setLowBat] = useState(false);
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('imei');
  const [asc, setAsc] = useState(true);

  // Telemetry stays current via the page's AutoRefresh (router.refresh re-seeds
  // `rows` on each cycle — added/removed devices included). Filters/sort below
  // are client state and survive those refreshes.
  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows.filter((d) => {
      if (status === 'online' && !d.is_online) return false;
      if (status === 'offline' && d.is_online) return false;
      if (assign === 'assigned' && !d.case_id) return false;
      if (assign === 'available' && d.case_id) return false;
      if (life !== 'all' && d.lifecycle !== life) return false;
      if (alertsOnly && d.open_alerts <= 0) return false;
      if (lowBat && (d.battery ?? 100) >= 20) return false;
      if (needle) {
        const hay = `${d.imei} ${d.model ?? ''} ${d.sim_number ?? ''} ${d.case_number ?? ''} ${d.case_name ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    list = list.slice().sort((a, b) => {
      let c = 0;
      if (sort === 'imei') c = a.imei.localeCompare(b.imei);
      else if (sort === 'battery') c = (a.battery ?? -1) - (b.battery ?? -1);
      else if (sort === 'lastSeen') c = (a.last_seen_at ? Date.parse(a.last_seen_at) : 0) - (b.last_seen_at ? Date.parse(b.last_seen_at) : 0);
      else if (sort === 'status') c = Number(a.is_online) - Number(b.is_online);
      return asc ? c : -c;
    });
    return list;
  }, [rows, q, status, assign, life, alertsOnly, lowBat, sort, asc]);

  // Pagination (keeps large fleets responsive). Reset to page 1 when the filtered
  // set changes so the operator never lands on an empty page.
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); }, [q, status, assign, life, alertsOnly, lowBat, sort, asc]);
  const totalPages = Math.max(1, Math.ceil(view.length / PAGE_SIZE));
  const cur = Math.min(page, totalPages);
  const paged = view.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE);

  const chip = (on: boolean) => `px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 flex-wrap">
        <Package className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">Bracelets électroniques</h3>
        <span className="text-xs text-gray-400">· {view.length}/{rows.length}</span>
        <span data-tip="Page actualisée automatiquement toutes les 20 s" className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> live
        </span>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Rechercher un bracelet"
              placeholder="IMEI, SIM, dossier, nom…"
              className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-5 py-2.5 border-b border-gray-50 flex items-center gap-1.5 flex-wrap bg-gray-50/60">
        <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-1">Statut</span>
        <button className={chip(status === 'all')} onClick={() => setStatus('all')}>Tous</button>
        <button className={chip(status === 'online')} onClick={() => setStatus('online')}>En ligne</button>
        <button className={chip(status === 'offline')} onClick={() => setStatus('offline')}>Hors ligne</button>
        <span className="text-[10px] uppercase tracking-wide text-gray-400 mx-1 ml-3">Affectation</span>
        <button className={chip(assign === 'all')} onClick={() => setAssign('all')}>Tous</button>
        <button className={chip(assign === 'assigned')} onClick={() => setAssign('assigned')}>Assignés</button>
        <button className={chip(assign === 'available')} onClick={() => setAssign('available')}>Disponibles</button>
        <span className="text-[10px] uppercase tracking-wide text-gray-400 mx-1 ml-3">Cycle de vie</span>
        {(['all', 'STOCK', 'ACTIVE', 'MAINTENANCE', 'RETIRED'] as LifeFilter[]).map((l) => (
          <button key={l} className={chip(life === l)} onClick={() => setLife(l)}>
            {l === 'all' ? 'Tous' : LIFECYCLE_LABEL[l]}
          </button>
        ))}
        <button className={chip(lowBat)} onClick={() => setLowBat((v) => !v)}>Batterie &lt; 20%</button>
        <button className={chip(alertsOnly)} onClick={() => setAlertsOnly((v) => !v)}>⚠ Alertes</button>
        <div className="ml-auto flex items-center gap-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Trier par" className="text-xs border border-gray-200 rounded-lg px-2 py-1">
            <option value="imei">IMEI</option>
            <option value="battery">Batterie</option>
            <option value="lastSeen">Dernier contact</option>
            <option value="status">Statut</option>
          </select>
          <button onClick={() => setAsc((v) => !v)} aria-label={asc ? 'Tri croissant (cliquer pour décroissant)' : 'Tri décroissant (cliquer pour croissant)'} className="text-xs border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50">{asc ? '↑' : '↓'}</button>
        </div>
      </div>

      {view.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-gray-400">
          <Package className="w-5 h-5" />
          <span className="text-sm">Aucun bracelet ne correspond aux filtres</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[
                  { h: 'IMEI', c: '' },
                  { h: 'Modèle', c: 'hidden lg:table-cell' },
                  { h: 'Statut', c: '' },
                  { h: 'Batterie', c: 'hidden sm:table-cell' },
                  { h: 'N° SIM', c: 'hidden xl:table-cell' },
                  { h: 'Dossier assigné', c: '' },
                  { h: 'Dernier contact', c: 'hidden md:table-cell' },
                ].map(({ h, c }) => (
                  <th key={h} className={`text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${c}`}>{h}</th>
                ))}
                {isHardwareAdmin && <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paged.map((d) => {
                const bat = d.battery ?? 0;
                return (
                  <tr key={d.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-700">
                      <Link href={`/sigep/dashboard/devices/${d.id}`} className="text-blue-700 hover:underline">{d.imei}</Link>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-600 hidden lg:table-cell">{d.model}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${d.is_online ? 'text-green-600' : 'text-gray-400'}`}>
                        {d.is_online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                        {d.is_online ? 'En ligne' : 'Hors ligne'}
                      </span>
                      <span className={`mt-1 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${d.worn === true ? 'bg-emerald-50 text-emerald-700' : d.worn === false ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-400'}`}>
                        {d.worn === true ? <><PersonStanding className="w-3 h-3" /> Porté</> : d.worn === false ? <><ShieldOff className="w-3 h-3" /> Retiré</> : <><PersonStanding className="w-3 h-3" /> Port inconnu</>}
                      </span>
                      <div className="mt-1 flex items-center gap-1 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${LIFECYCLE_STYLE[d.lifecycle]}`}>{LIFECYCLE_LABEL[d.lifecycle]}</span>
                        {d.open_alerts > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 inline-flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3" />{d.open_alerts}{d.alert_top ? ` · ${d.alert_top}` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className={`h-full rounded-full ${bat < 20 ? 'bg-red-400' : bat < 50 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${bat}%` }} />
                        </div>
                        <span className={`text-xs font-medium ${bat < 20 ? 'text-red-600' : 'text-gray-600'}`}>
                          <Battery className="inline w-3 h-3 mr-0.5" />{bat}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden xl:table-cell">
                      <SimPanel
                        deviceId={d.id}
                        canEdit={isHardwareAdmin}
                        sim={{ sim_number: d.sim_number, sim_carrier: d.sim_carrier, sim_activated_at: d.sim_activated_at, sim_status: d.sim_status }}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      {d.case_number ? (
                        <Link href={`/sigep/dashboard/cases/${d.case_id}`} className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md hover:underline">{d.case_number}</Link>
                      ) : (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">Disponible</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-400 hidden md:table-cell">{d.last_seen_at ? `il y a ${timeAgo(d.last_seen_at)}` : '—'}</td>
                    {isHardwareAdmin && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3 flex-wrap">
                          {d.case_id ? <span className="text-xs text-gray-400">Assigné</span> : <AssignDeviceControl deviceId={d.id} />}
                          <TestConnectionButton imei={d.imei} />
                          {(d.case_id || d.last_seen_at || d.is_online) && <DeviceCommandButtons imei={d.imei} />}
                          <BleScanButton imei={d.imei} />
                          <BleHighAvailButton imei={d.imei} active={d.ble_high_avail} />
                          <ProvisionButton imei={d.imei} />
                          <Link href={`/sigep/dashboard/devices/${d.id}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><ClipboardList className="w-3.5 h-3.5" /> Détail</Link>
                          <Link href={`/sigep/dashboard/devices/${d.id}/label`} target="_blank" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"><Tag className="w-3.5 h-3.5" /> Étiquette</Link>
                          <DeviceLifecycleButton deviceId={d.id} imei={d.imei} lifecycle={d.lifecycle} assigned={!!d.case_id} />
                          {!d.case_id && <DeleteDeviceButton deviceId={d.id} imei={d.imei} />}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50 text-xs text-gray-500">
          <span>{view.length} résultat{view.length > 1 ? 's' : ''} · page {cur}/{totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={cur <= 1} aria-label="Page précédente" className="px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">Précédent</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={cur >= totalPages} aria-label="Page suivante" className="px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">Suivant</button>
          </div>
        </div>
      )}
    </div>
  );
}
