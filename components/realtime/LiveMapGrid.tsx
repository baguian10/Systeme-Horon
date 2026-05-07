'use client';

import dynamic from 'next/dynamic';
import { usePositionFeed, type LivePosition } from '@/hooks/usePositionFeed';
import type { CaseStatus } from '@/lib/supabase/types';

const LiveTrackingMap = dynamic(() => import('./LiveTrackingMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center rounded-2xl">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Chargement de la carte…</p>
      </div>
    </div>
  ),
});

const STATUS_COLORS: Record<CaseStatus, string> = {
  ACTIVE:     'bg-green-400',
  VIOLATION:  'bg-red-500',
  PENDING:    'bg-yellow-400',
  SUSPENDED:  'bg-gray-400',
  TERMINATED: 'bg-slate-300',
};

interface Props {
  initialPositions?: LivePosition[];
}

export default function LiveMapGrid({ initialPositions = [] }: Props) {
  const positions = usePositionFeed(initialPositions);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-700" style={{ minHeight: 380 }}>

      {/* Leaflet map fills entire container */}
      <div className="absolute inset-0">
        <LiveTrackingMap positions={positions} />
      </div>

      {/* Top label overlay */}
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-1.5 pointer-events-none">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-medium text-slate-200">Ouagadougou — Temps réel</span>
      </div>

      {/* Legend overlay — bottom left */}
      <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-4 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 pointer-events-none">
        {(['ACTIVE', 'VIOLATION', 'PENDING'] as CaseStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[s]}`} />
            <span className="text-[10px] text-slate-300">
              {s === 'ACTIVE' ? 'Actif' : s === 'VIOLATION' ? 'Violation' : 'En attente'}
            </span>
          </div>
        ))}
      </div>

      {/* Live counter — bottom right */}
      <div className="absolute bottom-3 right-3 z-[1000] bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 pointer-events-none">
        <span className="text-[10px] text-slate-300">
          {positions.length} bracelet{positions.length !== 1 ? 's' : ''} localisé{positions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* No devices fallback */}
      {positions.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-[999] pointer-events-none">
          <div className="bg-slate-900/70 backdrop-blur-sm rounded-xl px-4 py-3">
            <p className="text-sm text-slate-400">Aucun dispositif actif</p>
          </div>
        </div>
      )}
    </div>
  );
}
