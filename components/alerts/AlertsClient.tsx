'use client';

import { Fragment, useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle, MapPin } from 'lucide-react';
import { AlertTypeBadge, SeverityDot } from '@/components/ui/StatusBadge';
import AlertActions from '@/components/alerts/AlertActions';
import MiniPositionMapLoader from '@/components/devices/MiniPositionMapLoader';
import { reopenAlertAction, deleteAlertAction } from '@/app/sigep/dashboard/alerts/actions';
import type { Alert, AlertStatus, AlertType } from '@/lib/supabase/types';

interface UserOpt { id: string; full_name: string }

const STATUS_META: Record<AlertStatus, { label: string; cls: string }> = {
  NEW:          { label: 'Nouvelle',  cls: 'bg-red-100 text-red-700' },
  ACKNOWLEDGED: { label: 'Vue',       cls: 'bg-amber-100 text-amber-700' },
  IN_PROGRESS:  { label: 'En cours',  cls: 'bg-blue-100 text-blue-700' },
  RESOLVED:     { label: 'Traitée',   cls: 'bg-emerald-100 text-emerald-700' },
  FALSE_ALARM:  { label: 'Fausse',    cls: 'bg-gray-100 text-gray-600' },
};

const SEVERITY_LABEL = ['', 'Faible', 'Modéré', 'Élevé', 'Critique', 'Maximal'];

const TYPE_LABELS: Record<AlertType, string> = {
  GEOFENCE_EXIT:    'Sortie zone',
  BLE_EXIT:         'Balise BLE',
  CURFEW_VIOLATION: 'Couvre-feu',
  TAMPER_DETECTED:  'Sabotage',
  HEALTH_CRITICAL:  'Santé critique',
  BATTERY_LOW:      'Batterie faible',
  SIGNAL_LOST:      'Signal perdu',
  PANIC_BUTTON:     'Bouton panique',
};

const OPEN_PER_PAGE     = 20;
const RESOLVED_PER_PAGE = 20;

function relativeAge(iso: string): string {
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h${mins % 60 ? String(mins % 60).padStart(2, '0') : ''}`;
  return `${Math.floor(hrs / 24)}j`;
}

function ageColor(iso: string, severity: number): string {
  const hrs = (Date.now() - Date.parse(iso)) / 3_600_000;
  if (severity >= 4 && hrs > 1) return 'text-red-600 font-semibold';
  if (severity >= 3 && hrs > 2) return 'text-amber-600 font-medium';
  return 'text-gray-500';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Africa/Ouagadougou',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AlertsClient({
  open,
  resolved,
  canResolve,
  canDelete = false,
  users,
}: {
  open: Alert[];
  resolved: Alert[];
  canResolve: boolean;
  canDelete?: boolean;
  users: UserOpt[];
}) {
  const nameOf = (id?: string | null) => users.find((u) => u.id === id)?.full_name ?? null;

  const [search, setSearch]             = useState('');
  const [filterType, setFilterType]     = useState('');
  const [filterSev, setFilterSev]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [openPage, setOpenPage]         = useState(0);
  const [resolvedPage, setResolvedPage] = useState(0);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [reopenPending, setReopenPending] = useState(false);
  const [deletingIds, setDeletingIds]     = useState<Set<string>>(new Set());

  // Reset to page 0 when filters change so the user never lands on an empty page.
  useEffect(() => { setOpenPage(0); setResolvedPage(0); }, [search, filterType, filterSev, filterStatus]);

  function handleDelete(alertId: string) {
    if (!window.confirm('Supprimer définitivement cette alerte ?')) return;
    setDeletingIds((s) => { const n = new Set(s); n.add(alertId); return n; });
    const fd = new FormData();
    fd.set('alertId', alertId);
    void deleteAlertAction(fd).then(() =>
      setDeletingIds((s) => { const n = new Set(s); n.delete(alertId); return n; })
    );
  }

  function handleReopen(alertId: string) {
    setReopenPending(true);
    const fd = new FormData();
    fd.set('alertId', alertId);
    void reopenAlertAction(fd).then(() => setReopenPending(false));
  }

  const filteredOpen = useMemo(() => {
    let list = open;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        (a.description ?? '').toLowerCase().includes(q) ||
        (a.case?.case_number ?? '').toLowerCase().includes(q)
      );
    }
    if (filterType) list = list.filter((a) => a.alert_type === filterType);
    if (filterSev)  list = list.filter((a) => a.severity === Number(filterSev));
    if (filterStatus) list = list.filter((a) => (a.status ?? 'NEW') === filterStatus);
    return [...list].sort((a, b) => b.severity - a.severity);
  }, [open, search, filterType, filterSev, filterStatus]);

  const filteredResolved = useMemo(() => {
    // Resolved alerts can never match an open-only status filter.
    if (filterStatus) return [];
    let list = resolved;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        (a.description ?? '').toLowerCase().includes(q) ||
        (a.case?.case_number ?? '').toLowerCase().includes(q)
      );
    }
    if (filterType) list = list.filter((a) => a.alert_type === filterType);
    if (filterSev)  list = list.filter((a) => a.severity === Number(filterSev));
    return list;
  }, [resolved, search, filterType, filterSev, filterStatus]);

  const openPages = Math.ceil(filteredOpen.length / OPEN_PER_PAGE);
  const openSlice = filteredOpen.slice(openPage * OPEN_PER_PAGE, (openPage + 1) * OPEN_PER_PAGE);

  const resolvedPages = Math.ceil(filteredResolved.length / RESOLVED_PER_PAGE);
  const resolvedSlice = filteredResolved.slice(
    resolvedPage * RESOLVED_PER_PAGE,
    (resolvedPage + 1) * RESOLVED_PER_PAGE
  );

  const hasFilters = search || filterType || filterSev || filterStatus;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="Rechercher dossier, description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
        >
          <option value="">Tous types</option>
          {(Object.keys(TYPE_LABELS) as AlertType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select
          value={filterSev}
          onChange={(e) => setFilterSev(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
        >
          <option value="">Toutes sév.</option>
          {[5, 4, 3, 2, 1].map((s) => (
            <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
        >
          <option value="">Tous statuts</option>
          {(['NEW', 'ACKNOWLEDGED', 'IN_PROGRESS'] as AlertStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setFilterType(''); setFilterSev(''); setFilterStatus(''); }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Effacer filtres
          </button>
        )}
      </div>

      {/* Open alerts */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            Alertes en cours
            {filteredOpen.length !== open.length && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({filteredOpen.length}/{open.length})
              </span>
            )}
          </h3>
          {openPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <button
                disabled={openPage === 0}
                onClick={() => setOpenPage((p) => p - 1)}
                className="px-2 py-0.5 rounded border disabled:opacity-40 hover:bg-gray-50"
              >
                ‹
              </button>
              <span>{openPage + 1} / {openPages}</span>
              <button
                disabled={openPage >= openPages - 1}
                onClick={() => setOpenPage((p) => p + 1)}
                className="px-2 py-0.5 rounded border disabled:opacity-40 hover:bg-gray-50"
              >
                ›
              </button>
            </div>
          )}
        </div>
        {filteredOpen.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            {open.length === 0
              ? 'Aucune alerte active — tous les dispositifs fonctionnent normalement.'
              : 'Aucun résultat pour ces filtres.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sév.</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dossier</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Bracelet</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Depuis</th>
                  {(canResolve || canDelete) && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {openSlice.map((alert) => {
                  const st = (alert.status ?? 'NEW') as AlertStatus;
                  const meta = STATUS_META[st] ?? STATUS_META.NEW;
                  const assignee = nameOf(alert.assigned_to);
                  const expanded = expandedId === alert.id;
                  const hasPos = alert.position_lat != null && alert.position_lon != null;
                  const colCount = (canResolve || canDelete) ? 8 : 7;
                  return (
                    <Fragment key={alert.id}>
                      <tr
                        onClick={() => setExpandedId(expanded ? null : alert.id)}
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <SeverityDot level={alert.severity} />
                            <span className="text-xs text-gray-500">{SEVERITY_LABEL[alert.severity]}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5"><AlertTypeBadge type={alert.alert_type} /></td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${meta.cls}`}>
                            {meta.label}
                          </span>
                          {['GEOFENCE_EXIT', 'BLE_EXIT', 'CURFEW_VIOLATION', 'TAMPER_DETECTED'].includes(alert.alert_type) && (
                            alert.condition_cleared_at ? (
                              <div className="text-[10px] text-emerald-600 mt-0.5">↩ Condition levée {relativeAge(alert.condition_cleared_at)}</div>
                            ) : (
                              <div className="text-[10px] text-red-500 mt-0.5">● Épisode en cours</div>
                            )
                          )}
                          {assignee && <div className="text-[11px] text-gray-400 mt-0.5">→ {assignee}</div>}
                        </td>
                        <td className="px-5 py-3.5 max-w-xs">
                          <p className="text-xs text-gray-600 line-clamp-2">{alert.description ?? '—'}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <Link href={`/sigep/dashboard/cases/${alert.case_id}`} onClick={(e) => e.stopPropagation()} className="text-xs text-blue-600 hover:underline font-mono">
                            {alert.case?.case_number ?? alert.case_id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell">
                          {alert.device_id ? (
                            <Link href={`/sigep/dashboard/devices/${alert.device_id}`} onClick={(e) => e.stopPropagation()} className="text-xs text-blue-600 hover:underline font-mono">
                              …{alert.device?.imei?.slice(-6) ?? alert.device_id.slice(0, 6)}
                            </Link>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`text-xs ${ageColor(alert.triggered_at, alert.severity)}`}>
                            {relativeAge(alert.triggered_at)}
                          </span>
                          <div className="text-[10px] text-gray-400">{formatDate(alert.triggered_at)}</div>
                        </td>
                        {(canResolve || canDelete) && (
                          <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col items-end gap-1">
                              {canResolve && <AlertActions alertId={alert.id} status={st} assignedTo={alert.assigned_to ?? null} users={users} />}
                              {canDelete && (
                                <button
                                  disabled={deletingIds.has(alert.id)}
                                  onClick={() => handleDelete(alert.id)}
                                  className="text-[11px] text-red-500 hover:text-red-700 disabled:opacity-40"
                                >
                                  Supprimer
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      {expanded && (
                        <tr className="bg-blue-50/40 border-b border-blue-100">
                          <td colSpan={colCount} className="px-5 py-4">
                            <div className="flex gap-4 flex-wrap">
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <p className="text-xs font-medium text-gray-700">Description complète</p>
                                <p className="text-sm text-gray-600">{alert.description ?? '—'}</p>
                                {hasPos && (
                                  <p className="text-[11px] text-gray-400 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {alert.position_lat!.toFixed(5)}, {alert.position_lon!.toFixed(5)}
                                  </p>
                                )}
                              </div>
                              {hasPos && (
                                <div className="w-64 h-40 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                                  <MiniPositionMapLoader
                                    lat={alert.position_lat!}
                                    lng={alert.position_lon!}
                                    label={alert.case?.case_number ?? ''}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resolved */}
      {filteredResolved.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-600">
              Alertes clôturées ({filteredResolved.length}{resolved.length >= 500 ? '+' : ''})
            </h3>
            {resolvedPages > 1 && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <button
                  disabled={resolvedPage === 0}
                  onClick={() => setResolvedPage((p) => p - 1)}
                  className="px-2 py-0.5 rounded border disabled:opacity-40 hover:bg-gray-50"
                >
                  ‹
                </button>
                <span>{resolvedPage + 1} / {resolvedPages}</span>
                <button
                  disabled={resolvedPage >= resolvedPages - 1}
                  onClick={() => setResolvedPage((p) => p + 1)}
                  className="px-2 py-0.5 rounded border disabled:opacity-40 hover:bg-gray-50"
                >
                  ›
                </button>
              </div>
            )}
          </div>
          <ul className="divide-y divide-gray-50">
            {resolvedSlice.map((alert) => {
              const st = (alert.status ?? 'RESOLVED') as AlertStatus;
              const meta = STATUS_META[st] ?? STATUS_META.RESOLVED;
              return (
                <li key={alert.id} className="px-5 py-3 flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <AlertTypeBadge type={alert.alert_type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Link href={`/sigep/dashboard/cases/${alert.case_id}`} className="text-xs text-blue-600 hover:underline font-mono">
                        {alert.case?.case_number ?? alert.case_id.slice(0, 8)}
                      </Link>
                      {alert.device_id && (
                        <Link href={`/sigep/dashboard/devices/${alert.device_id}`} className="text-xs text-gray-400 hover:underline font-mono">
                          #{alert.device?.imei?.slice(-6) ?? alert.device_id.slice(0, 6)}
                        </Link>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{alert.description}</p>
                    {alert.resolution_reason && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        <span className={`inline-block px-1.5 rounded ${meta.cls}`}>{meta.label}</span>
                        {' — '}{alert.resolution_reason}
                        {nameOf(alert.resolved_by) && <> · par {nameOf(alert.resolved_by)}</>}
                      </p>
                    )}
                    {alert.acknowledged_at && (
                      <p className="text-[10px] text-gray-400">
                        Vu{nameOf(alert.acknowledged_by) ? ` par ${nameOf(alert.acknowledged_by)}` : ''}{' · '}
                        {formatDate(alert.acknowledged_at)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(alert.resolved_at ?? alert.triggered_at)}
                    </span>
                    {canResolve && (
                      <button
                        disabled={reopenPending}
                        onClick={() => handleReopen(alert.id)}
                        className="text-[11px] text-amber-600 hover:text-amber-700 font-medium disabled:opacity-40"
                      >
                        Rouvrir
                      </button>
                    )}
                    {canDelete && (
                      <button
                        disabled={deletingIds.has(alert.id)}
                        onClick={() => handleDelete(alert.id)}
                        className="text-[11px] text-red-500 hover:text-red-700 disabled:opacity-40"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
