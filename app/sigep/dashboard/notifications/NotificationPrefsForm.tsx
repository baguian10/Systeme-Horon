'use client';

import { useState } from 'react';
import { Bell, Smartphone, Mail, CheckCircle2 } from 'lucide-react';

const ALERT_TYPES = [
  { key: 'GEOFENCE_EXIT',   label: 'Sortie de zone',   severity: 'critical' },
  { key: 'TAMPER_DETECTED', label: 'Anti-sabotage',     severity: 'critical' },
  { key: 'HEALTH_CRITICAL', label: 'Santé critique',    severity: 'critical' },
  { key: 'PANIC_BUTTON',    label: 'Bouton panique',    severity: 'critical' },
  { key: 'BATTERY_LOW',     label: 'Batterie faible',   severity: 'info' },
  { key: 'SIGNAL_LOST',     label: 'Signal perdu',      severity: 'info' },
];

const CHANNELS = [
  { key: 'push',  label: 'Push',  icon: Bell },
  { key: 'sms',   label: 'SMS',   icon: Smartphone },
  { key: 'email', label: 'Email', icon: Mail },
];

type Prefs = Record<string, Record<string, boolean>>;

const DEFAULT_PREFS: Prefs = {
  GEOFENCE_EXIT:   { push: true,  sms: true,  email: false },
  TAMPER_DETECTED: { push: true,  sms: true,  email: true  },
  HEALTH_CRITICAL: { push: true,  sms: false, email: false },
  PANIC_BUTTON:    { push: true,  sms: true,  email: true  },
  BATTERY_LOW:     { push: true,  sms: false, email: false },
  SIGNAL_LOST:     { push: false, sms: false, email: false },
};

export default function NotificationPrefsForm() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  function toggle(alertKey: string, channel: string) {
    setPrefs((prev) => ({
      ...prev,
      [alertKey]: { ...prev[alertKey], [channel]: !prev[alertKey][channel] },
    }));
    setSaved(false);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Channel headers */}
      <div className="grid grid-cols-4 gap-2 text-[10px] text-gray-400 font-semibold uppercase">
        <span className="col-span-1">Type</span>
        {CHANNELS.map((ch) => (
          <span key={ch.key} className="text-center">{ch.label}</span>
        ))}
      </div>

      {ALERT_TYPES.map((at) => (
        <div key={at.key} className="grid grid-cols-4 gap-2 items-center">
          <div className="col-span-1">
            <p className="text-xs font-medium text-gray-700 leading-tight">{at.label}</p>
            <span className={`text-[9px] font-bold ${at.severity === 'critical' ? 'text-red-500' : 'text-gray-400'}`}>
              {at.severity === 'critical' ? 'CRITIQUE' : 'INFO'}
            </span>
          </div>
          {CHANNELS.map((ch) => {
            const ChIcon = ch.icon;
            const on = prefs[at.key]?.[ch.key] ?? false;
            return (
              <button
                key={ch.key}
                onClick={() => toggle(at.key, ch.key)}
                className={`flex items-center justify-center rounded-lg py-1.5 border transition-all ${
                  on
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-gray-200 text-gray-300 hover:border-gray-300'
                }`}
              >
                <ChIcon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
      ))}

      <button
        onClick={handleSave}
        className={`w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all ${
          saved
            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            : 'bg-emerald-600 text-white hover:bg-emerald-500'
        }`}
      >
        {saved ? (
          <><CheckCircle2 className="w-3.5 h-3.5" /> Préférences sauvegardées</>
        ) : (
          'Enregistrer les préférences'
        )}
      </button>
    </div>
  );
}
