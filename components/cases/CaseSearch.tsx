'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';
import type { CaseStatus, RiskLevel } from '@/lib/supabase/types';

const STATUS_LABELS: Record<CaseStatus, string> = {
  ACTIVE: 'Actifs', VIOLATION: 'Violation', PENDING: 'En attente',
  SUSPENDED: 'Suspendus', TERMINATED: 'Clôturés', ARCHIVED: 'Archivés',
};
const STATUSES = Object.keys(STATUS_LABELS) as CaseStatus[];

const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: 'Risque faible', MEDIUM: 'Risque moyen', HIGH: 'Risque élevé',
};

export default function CaseSearch({ total }: { total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q      = params.get('q')      ?? '';
  const status = params.get('status') ?? '';
  const risk   = params.get('risk')   ?? '';
  const sort   = params.get('sort')   ?? '';

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <input
          value={q}
          onChange={(e) => update('q', e.target.value)}
          placeholder="N° dossier ou individu..."
          className="pl-8 pr-7 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
        />
        {q && (
          <button onClick={() => update('q', '')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => update('status', '')}
          className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${!status ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
          Tous
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => update('status', status === s ? '' : s)}
            className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${status === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Risk filter */}
      <select
        value={risk}
        onChange={(e) => update('risk', e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
      >
        <option value="">Tous niveaux</option>
        {(Object.keys(RISK_LABELS) as RiskLevel[]).map((r) => (
          <option key={r} value={r}>{RISK_LABELS[r]}</option>
        ))}
      </select>

      {/* Sort */}
      <select
        value={sort}
        onChange={(e) => update('sort', e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
      >
        <option value="">Tri par défaut</option>
        <option value="risk">Risque ↓</option>
        <option value="alerts">Alertes ↓</option>
        <option value="end">Date fin ↑</option>
      </select>

      <span className="text-xs text-gray-400 ml-auto">{total} résultat{total !== 1 ? 's' : ''}</span>
    </div>
  );
}
