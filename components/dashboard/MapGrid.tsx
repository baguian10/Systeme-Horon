'use client';

import { useEffect, useRef } from 'react';
import type { CaseStatus } from '@/lib/supabase/types';

interface MapPoint {
  label: string;
  lat: number;
  lon: number;
  status: CaseStatus;
  alertCount: number;
}

const STATUS_COLORS: Record<CaseStatus, string> = {
  ACTIVE:     'bg-green-500',
  PENDING:    'bg-yellow-400',
  SUSPENDED:  'bg-gray-400',
  TERMINATED: 'bg-slate-300',
  VIOLATION:  'bg-red-500',
};

// Bamako bounding box
const BBOX = { minLat: 12.55, maxLat: 12.75, minLon: -8.10, maxLon: -7.85 };

function normalize(val: number, min: number, max: number) {
  return ((val - min) / (max - min)) * 100;
}

export default function MapGrid({ points }: { points: MapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700"
      style={{ minHeight: 340 }}
    >
      {/* Grid lines */}
      <div className="absolute inset-0 opacity-10">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`h${i}`} className="absolute left-0 right-0 border-t border-slate-400" style={{ top: `${i * 20}%` }} />
        ))}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`v${i}`} className="absolute top-0 bottom-0 border-l border-slate-400" style={{ left: `${i * 20}%` }} />
        ))}
      </div>

      {/* Map label */}
      <div className="absolute top-3 left-3 text-xs text-slate-500 font-medium">
        Bamako, Mali — Positions en temps réel
      </div>

      {/* Compass */}
      <div className="absolute top-3 right-3 text-xs text-slate-600 font-bold select-none">N↑</div>

      {/* Device dots */}
      {points.map((pt) => {
        const x = normalize(pt.lon, BBOX.minLon, BBOX.maxLon);
        const y = 100 - normalize(pt.lat, BBOX.minLat, BBOX.maxLat);
        return (
          <div
            key={pt.label}
            className="absolute group"
            style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
          >
            {/* Pulse ring for violations */}
            {pt.status === 'VIOLATION' && (
              <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping scale-150" />
            )}
            <div className={`w-3.5 h-3.5 rounded-full ${STATUS_COLORS[pt.status]} border-2 border-white/80 shadow-lg cursor-pointer`} />

            {/* Alert badge */}
            {pt.alertCount > 0 && (
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {pt.alertCount}
              </div>
            )}

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
              <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white whitespace-nowrap shadow-xl">
                <p className="font-semibold">{pt.label}</p>
                <p className="text-gray-400">
                  {pt.lat.toFixed(4)}, {pt.lon.toFixed(4)}
                </p>
                {pt.alertCount > 0 && (
                  <p className="text-red-400 font-medium mt-0.5">{pt.alertCount} alerte{pt.alertCount > 1 ? 's' : ''}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3">
        {(['ACTIVE', 'VIOLATION', 'PENDING'] as CaseStatus[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[s]}`} />
            <span className="text-[10px] text-slate-400">
              {s === 'ACTIVE' ? 'Actif' : s === 'VIOLATION' ? 'Violation' : 'En attente'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
