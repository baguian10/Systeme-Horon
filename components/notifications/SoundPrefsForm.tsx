'use client';

import { useEffect, useState } from 'react';
import { Volume2, Play, Shield, AlertTriangle, Battery, Wifi, Bell, Zap } from 'lucide-react';
import {
  getSoundPrefs, setSoundPrefs, playSound,
  SOUND_LABELS, type AlertSoundPrefs, type SoundKind,
} from '@/lib/sound/alertSounds';
import type { AlertType } from '@/lib/supabase/types';

const TYPE_META: Record<AlertType, { label: string; icon: typeof Bell; color: string }> = {
  GEOFENCE_EXIT:    { label: 'Sortie de zone',        icon: Shield,        color: 'text-red-600' },
  BLE_EXIT:         { label: 'Sortie domicile (BLE)', icon: Shield,        color: 'text-blue-600' },
  CURFEW_VIOLATION: { label: 'Couvre-feu',            icon: Shield,        color: 'text-violet-600' },
  TAMPER_DETECTED:  { label: 'Anti-sabotage',          icon: AlertTriangle, color: 'text-orange-600' },
  PANIC_BUTTON:     { label: 'Bouton panique',        icon: Bell,          color: 'text-red-800' },
  HEALTH_CRITICAL:  { label: 'Santé critique',        icon: Zap,           color: 'text-red-700' },
  BATTERY_LOW:      { label: 'Batterie faible',       icon: Battery,       color: 'text-amber-600' },
  SIGNAL_LOST:      { label: 'Signal réseau',          icon: Wifi,          color: 'text-gray-600' },
};

const SOUND_OPTIONS: SoundKind[] = ['police', 'wail', 'beeps', 'chime', 'off'];

export default function SoundPrefsForm() {
  const [prefs, setPrefs] = useState<AlertSoundPrefs | null>(null);

  // localStorage is browser-only — hydrate after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrefs(getSoundPrefs());
  }, []);

  if (!prefs) return null;

  function update(type: AlertType, patch: Partial<{ enabled: boolean; sound: SoundKind }>) {
    setPrefs((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [type]: { ...prev[type], ...patch } };
      setSoundPrefs(next);
      return next;
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
        <Volume2 className="w-4 h-4 text-emerald-600" />
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Sons d&apos;alerte</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Personnalisez le son joué à l&apos;arrivée de chaque type d&apos;alerte sur ce poste.
          </p>
        </div>
      </div>
      <ul className="divide-y divide-gray-50">
        {(Object.keys(TYPE_META) as AlertType[]).map((type) => {
          const meta = TYPE_META[type];
          const Icon = meta.icon;
          const p = prefs[type] ?? { enabled: true, sound: 'beeps' as SoundKind };
          return (
            <li key={type} className="px-5 py-3 flex items-center gap-3 flex-wrap">
              <Icon className={`w-4 h-4 flex-shrink-0 ${meta.color}`} />
              <span className="text-sm text-gray-800 font-medium w-44 flex-shrink-0">{meta.label}</span>

              {/* Enable toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) => update(type, { enabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span className="text-xs text-gray-500">{p.enabled ? 'Activé' : 'Coupé'}</span>
              </label>

              {/* Sound choice */}
              <select
                value={p.sound}
                disabled={!p.enabled}
                onChange={(e) => update(type, { sound: e.target.value as SoundKind })}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs disabled:opacity-40 disabled:bg-gray-50"
              >
                {SOUND_OPTIONS.map((k) => (
                  <option key={k} value={k}>{SOUND_LABELS[k]}</option>
                ))}
              </select>

              {/* Test button */}
              <button
                type="button"
                onClick={() => playSound(p.sound)}
                disabled={!p.enabled || p.sound === 'off'}
                title="Écouter"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-emerald-50 text-gray-500 hover:text-emerald-700 text-xs font-medium transition-colors disabled:opacity-30"
              >
                <Play className="w-3 h-3" /> Test
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-gray-400 px-5 py-3 border-t border-gray-50">
        Préférences enregistrées sur ce navigateur. Le bouton « Son ON/OFF » en bas de l&apos;écran coupe tous les sons d&apos;un coup.
        Les navigateurs exigent une première interaction (clic ou touche) avant de pouvoir jouer un son.
      </p>
    </div>
  );
}
