'use client';

import dynamic from 'next/dynamic';
import type { ViolationHeatPoint } from '@/lib/supabase/types';

const ViolationHeatmapMap = dynamic(() => import('./ViolationHeatmapMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-gray-400">Chargement de la heatmap…</p>
      </div>
    </div>
  ),
});

export default function HeatmapWrapper({ points }: { points: ViolationHeatPoint[] }) {
  return (
    <div style={{ height: '100%', width: '100%' }}>
      <ViolationHeatmapMap points={points} />
    </div>
  );
}
