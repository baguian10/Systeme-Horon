'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, Zap, AlertTriangle, ShieldAlert, Heart, ChevronDown, ChevronUp } from 'lucide-react';
import { IS_DEMO_MODE } from '@/lib/supabase/client';
import type { AlertType } from '@/lib/supabase/types';

export default function DemoControls() {
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  const [engine, setEngine] = useState<import('@/lib/simulator/engine').SimulatorEngine | null>(null);

  useEffect(() => {
    if (!IS_DEMO_MODE) return;
    import('@/lib/simulator/engine').then(({ getSimulatorEngine }) => {
      const eng = getSimulatorEngine();
      setEngine(eng);
      setRunning(eng.isRunning());
    });
  }, []);

  if (!IS_DEMO_MODE || !engine) return null;

  function toggleRunning() {
    if (!engine) return;
    if (running) { engine.stop(); setRunning(false); }
    else { engine.start(speed); setRunning(true); }
  }

  function changeSpeed(s: number) {
    setSpeed(s);
    if (engine && running) { engine.stop(); engine.start(s); }
  }

  function inject(type?: AlertType) {
    engine?.injectAlert(type);
  }

  const ALERT_SHORTCUTS: { type: AlertType; icon: React.ReactNode; label: string }[] = [
    { type: 'GEOFENCE_EXIT',   icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Zone' },
    { type: 'TAMPER_DETECTED', icon: <ShieldAlert className="w-3.5 h-3.5" />,   label: 'Sabotage' },
    { type: 'HEALTH_CRITICAL', icon: <Heart className="w-3.5 h-3.5" />,          label: 'Santé' },
  ];

  return (
    <div className="bg-amber-950/80 border border-amber-700/50 rounded-2xl overflow-hidden backdrop-blur">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 text-amber-300 hover:bg-amber-900/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Contrôles simulateur</span>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {/* Play / Pause */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleRunning}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                running
                  ? 'bg-amber-600 text-white hover:bg-amber-500'
                  : 'bg-green-600 text-white hover:bg-green-500'
              }`}
            >
              {running
                ? <><Pause className="w-3.5 h-3.5" /> Pause</>
                : <><Play className="w-3.5 h-3.5" /> Démarrer</>}
            </button>
            <span className={`text-xs ${running ? 'text-green-400' : 'text-slate-500'}`}>
              {running ? '● Simulation active' : '○ En pause'}
            </span>
          </div>

          {/* Speed */}
          <div>
            <p className="text-[10px] text-amber-500 uppercase tracking-wide mb-1.5">Vitesse</p>
            <div className="flex gap-2">
              {[0.5, 1, 2, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => changeSpeed(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    speed === s
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-900/50 text-amber-300 hover:bg-amber-800/60'
                  }`}
                >
                  ×{s}
                </button>
              ))}
            </div>
          </div>

          {/* Inject alert */}
          <div>
            <p className="text-[10px] text-amber-500 uppercase tracking-wide mb-1.5">Injecter une alerte</p>
            <div className="flex flex-wrap gap-2">
              {ALERT_SHORTCUTS.map(({ type, icon, label }) => (
                <button
                  key={type}
                  onClick={() => inject(type)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-900/50 border border-amber-700/40 text-amber-300 hover:bg-red-900/50 hover:border-red-600/40 hover:text-red-300 text-xs transition-colors"
                >
                  {icon} {label}
                </button>
              ))}
              <button
                onClick={() => inject()}
                className="px-2.5 py-1 rounded-lg bg-amber-900/50 border border-amber-700/40 text-amber-300 hover:bg-amber-800/50 text-xs transition-colors"
              >
                Aléatoire
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
