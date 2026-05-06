'use client';

import { useRef, useEffect } from 'react';
import { usePositionFeed, type LivePosition } from '@/hooks/usePositionFeed';
import type { CaseStatus } from '@/lib/supabase/types';

// Ouagadougou bounding box
const BBOX = { minLat: 12.25, maxLat: 12.45, minLon: -1.65, maxLon: -1.45 };

function norm(val: number, min: number, max: number) {
  return Math.min(100, Math.max(0, ((val - min) / (max - min)) * 100));
}

const STATUS_COLORS: Record<CaseStatus, { dot: string; ring: string }> = {
  ACTIVE:     { dot: 'bg-green-400',  ring: '' },
  PENDING:    { dot: 'bg-yellow-400', ring: '' },
  SUSPENDED:  { dot: 'bg-gray-400',   ring: '' },
  TERMINATED: { dot: 'bg-slate-300',  ring: '' },
  VIOLATION:  { dot: 'bg-red-500',    ring: 'animate-ping bg-red-500/30' },
};

interface Props {
  initialPositions?: LivePosition[];
}

export default function LiveMapGrid({ initialPositions = [] }: Props) {
  const positions = usePositionFeed(initialPositions);

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700" style={{ minHeight: 380 }}>
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`h${i}`} className="absolute left-0 right-0 border-t border-slate-300" style={{ top: `${i * 12.5}%` }} />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={`v${i}`} className="absolute top-0 bottom-0 border-l border-slate-300" style={{ left: `${i * 12.5}%` }} />
        ))}
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-medium text-slate-300">Ouagadougou — Temps réel</span>
      </div>
      <div className="absolute top-3 right-3 text-xs font-bold text-slate-500 select-none">N↑</div>

      {/* Device positions */}
      {positions.map((pos) => {
        const x = norm(pos.longitude, BBOX.minLon, BBOX.maxLon);
        const y = 100 - norm(pos.latitude, BBOX.minLat, BBOX.maxLat);
        const { dot, ring } = STATUS_COLORS[pos.status] ?? STATUS_COLORS.ACTIVE;

        return (
          <div
            key={pos.case_id}
            className="absolute group z-20"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: 'translate(-50%, -50%)',
              transition: 'left 1.5s ease-out, top 1.5s ease-out',
            }}
          >
            {/* Pulse ring for violations */}
            {ring && (
              <div className={`absolute rounded-full w-6 h-6 -inset-[6px] ${ring}`} />
            )}

            {/* Device dot */}
            <div className={`w-3.5 h-3.5 rounded-full ${dot} border-2 border-white/80 shadow-lg cursor-default`} />

            {/* Alert badge */}
            {pos.alert_count > 0 && (
              <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none z-10">
                {pos.alert_count}
              </div>
            )}

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover:block z-30 pointer-events-none">
              <div className="bg-gray-900/95 border border-gray-700 rounded-xl px-3 py-2.5 shadow-2xl whitespace-nowrap text-left">
                <p className="text-xs font-semibold text-white font-mono">{pos.case_number}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {pos.latitude.toFixed(5)}, {pos.longitude.toFixed(5)}
                </p>
                {pos.speed_kmh !== null && (
                  <p className="text-[10px] text-slate-400">{pos.speed_kmh.toFixed(1)} km/h</p>
                )}
                {pos.alert_count > 0 && (
                  <p className="text-[10px] text-red-400 font-semibold mt-0.5">
                    {pos.alert_count} alerte{pos.alert_count > 1 ? 's' : ''} active{pos.alert_count > 1 ? 's' : ''}
                  </p>
                )}
                <p className="text-[9px] text-slate-600 mt-0.5">
                  {new Date(pos.recorded_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {/* No devices */}
      {positions.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-slate-500">Aucun dispositif actif</p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-4 z-10">
        {(['ACTIVE', 'VIOLATION', 'PENDING'] as CaseStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[s].dot}`} />
            <span className="text-[10px] text-slate-400">
              {s === 'ACTIVE' ? 'Actif' : s === 'VIOLATION' ? 'Violation' : 'En attente'}
            </span>
          </div>
        ))}
      </div>

      {/* Live counter */}
      <div className="absolute bottom-3 right-3 text-[10px] text-slate-500 z-10">
        {positions.length} bracelet{positions.length !== 1 ? 's' : ''} localisé{positions.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
