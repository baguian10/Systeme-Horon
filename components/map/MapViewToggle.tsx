'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Map, Flame } from 'lucide-react';

export default function MapViewToggle({ currentView }: { currentView: 'tracking' | 'heatmap' }) {
  const router   = useRouter();
  const pathname = usePathname();

  function switchTo(view: 'tracking' | 'heatmap') {
    router.push(view === 'heatmap' ? `${pathname}?view=heatmap` : pathname);
  }

  return (
    <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
      <button
        onClick={() => switchTo('tracking')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          currentView === 'tracking'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <Map className="w-3.5 h-3.5" />
        Suivi temps réel
      </button>
      <button
        onClick={() => switchTo('heatmap')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          currentView === 'heatmap'
            ? 'bg-white text-orange-600 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <Flame className="w-3.5 h-3.5" />
        Chaleur violations
      </button>
    </div>
  );
}
