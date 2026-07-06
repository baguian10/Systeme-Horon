'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Map, Flame, Route } from 'lucide-react';

type View = 'tracking' | 'heatmap' | 'history';

export default function MapViewToggle({ currentView }: { currentView: View }) {
  const router   = useRouter();
  const pathname = usePathname();

  function switchTo(view: View) {
    router.push(view === 'tracking' ? pathname : `${pathname}?view=${view}`);
  }

  const items: { view: View; label: string; icon: React.ReactNode; active: string }[] = [
    { view: 'tracking', label: 'Suivi temps réel',  icon: <Map className="w-3.5 h-3.5" />,   active: 'text-gray-900' },
    { view: 'heatmap',  label: 'Chaleur violations', icon: <Flame className="w-3.5 h-3.5" />, active: 'text-orange-600' },
    { view: 'history',  label: 'Historique',         icon: <Route className="w-3.5 h-3.5" />, active: 'text-violet-600' },
  ];

  return (
    <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
      {items.map((it) => (
        <button
          key={it.view}
          onClick={() => switchTo(it.view)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            currentView === it.view
              ? `bg-white ${it.active} shadow-sm`
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  );
}
