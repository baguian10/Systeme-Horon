'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, MapPin, Clock, Zap, Download, Search, Repeat,
} from 'lucide-react';

export interface InfractionRow {
  id: string;
  alert_type: string;
  severity: number;
  description: string | null;
  triggered_at: string;
  is_resolved: boolean;
  resolved_at: string | null;
  case_id: string;
  case_number: string | null;
  position_lat: number | null;
  position_lon: number | null;
  /** Nth infraction of this case (chronological) and case total — recidivism. */
  nth: number;
  caseTotal: number;
}

const TYPE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  GEOFENCE_EXIT:    { label: 'Sortie de périmètre',   color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-100' },
  BLE_EXIT:         { label: 'Sortie domicile (BLE)', color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-100' },
  CURFEW_VIOLATION: { label: 'Couvre-feu',            color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
  TAMPER_DETECTED:  { label: 'Tentative de sabotage',  color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
};

const SEV_LABEL = ['', 'Faible', 'Modéré', 'Élevé', 'Critique', 'Maximal'];
const SEV_COLOR = ['', 'text-green-600', 'text-yellow-600', 'text-orange-600', 'text-red-600', 'text-red-700'];
const SEV_BG    = ['', 'bg-green-50', 'bg-yellow-50', 'bg-orange-50', 'bg-red-50', 'bg-red-100'];

const PAGE_SIZE = 25;

function formatDT(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { timeZone: 'Africa/Ouagadougou',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

export default function InfractionsList({ rows }: { rows: InfractionRow[] }) {
  const [typeFilter, setTypeFilter] = useState('');
  const [sevFilter, setSevFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((v) => {
      if (typeFilter && v.alert_type !== typeFilter) return false;
      if (sevFilter === 'critical' && v.severity < 4) return false;
      if (sevFilter === 'moderate' && v.severity !== 3) return false;
      if (sevFilter === 'low' && v.severity > 2) return false;
      if (statusFilter === 'open' && v.is_resolved) return false;
      if (statusFilter === 'resolved' && !v.is_resolved) return false;
      if (q && !(v.case_number ?? '').toLowerCase().includes(q) && !(v.description ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, typeFilter, sevFilter, statusFilter, query]);

  const totalPages = Math.max(1, Math.ceil(view.length / PAGE_SIZE));
  const slice = view.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(0); };
  }

  function exportCSV() {
    const esc = (s: string | number | null) => {
      const str = String(s ?? '');
      return /[",;\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = ['Horodatage;Type;Sévérité;Dossier;Récidive;Description;Latitude;Longitude;Statut;Résolue le'];
    for (const v of view) {
      lines.push([
        formatDT(v.triggered_at),
        TYPE_META[v.alert_type]?.label ?? v.alert_type,
        `${v.severity} (${SEV_LABEL[v.severity]})`,
        v.case_number ?? v.case_id.slice(0, 8),
        `${v.nth}/${v.caseTotal}`,
        v.description ?? '',
        v.position_lat ?? '',
        v.position_lon ?? '',
        v.is_resolved ? 'Résolue' : 'Active',
        v.resolved_at ? formatDT(v.resolved_at) : '',
      ].map(esc).join(';'));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `infractions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2 flex-wrap">
        <h3 className="font-semibold text-gray-900 text-sm mr-1">Chronologie ({view.length})</h3>
        <div className="relative flex-1 min-w-[140px] max-w-[240px]">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => resetPage(setQuery)(e.target.value)}
            placeholder="Dossier, description…"
            className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <select value={typeFilter} onChange={(e) => resetPage(setTypeFilter)(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
          <option value="">Tous types</option>
          {Object.entries(TYPE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
        <select value={sevFilter} onChange={(e) => resetPage(setSevFilter)(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
          <option value="">Toutes sévérités</option>
          <option value="critical">Critiques (≥4)</option>
          <option value="moderate">Modérées (3)</option>
          <option value="low">Faibles (≤2)</option>
        </select>
        <select value={statusFilter} onChange={(e) => resetPage(setStatusFilter)(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
          <option value="">Tous statuts</option>
          <option value="open">Actives</option>
          <option value="resolved">Résolues</option>
        </select>
        <button
          onClick={exportCSV}
          data-tip="Exporter la sélection filtrée en CSV (production judiciaire)"
          className="inline-flex items-center gap-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
        >
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      {slice.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center px-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <AlertTriangle className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-gray-700">Aucune infraction ne correspond</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {slice.map((v) => {
            const meta = TYPE_META[v.alert_type] ?? TYPE_META.GEOFENCE_EXIT;
            const isOpen = !v.is_resolved;
            return (
              <div key={v.id} className={`px-5 py-4 flex items-start gap-4 transition-colors hover:bg-gray-50/50 ${isOpen ? 'border-l-4 border-red-400' : 'border-l-4 border-transparent'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg} ${meta.border} border`}>
                  <Zap className={`w-4 h-4 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.border} ${meta.color}`}>{meta.label}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${SEV_BG[v.severity]} ${SEV_COLOR[v.severity]}`}>
                        Sév. {v.severity} — {SEV_LABEL[v.severity]}
                      </span>
                      {v.caseTotal > 1 && (
                        <span
                          data-tip={`${v.caseTotal} infractions au total sur ce dossier — élément de récidive`}
                          className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${v.caseTotal >= 3 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                        >
                          <Repeat className="w-2.5 h-2.5" /> {v.nth}ᵉ/{v.caseTotal}
                        </span>
                      )}
                      {isOpen && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-md animate-pulse">ACTIVE</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                      <Clock className="w-3 h-3" /> {timeAgo(v.triggered_at)}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">{v.description ?? '—'}</p>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <Link href={`/sigep/dashboard/cases/${v.case_id}`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-mono font-semibold">
                      {v.case_number ?? v.case_id.slice(0, 8)}
                    </Link>
                    {v.position_lat != null && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-mono">
                        <MapPin className="w-3 h-3" /> {v.position_lat.toFixed(4)}, {v.position_lon?.toFixed(4)}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{formatDT(v.triggered_at)}</span>
                    {v.is_resolved && v.resolved_at && (
                      <span className="text-xs text-emerald-600 font-medium">✓ Résolu {formatDT(v.resolved_at)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30">← Précédent</button>
          <span className="text-xs text-gray-400">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="text-xs text-gray-500 hover:text-gray-800 disabled:opacity-30">Suivant →</button>
        </div>
      )}
    </div>
  );
}
