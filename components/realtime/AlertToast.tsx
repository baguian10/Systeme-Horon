'use client';

import { X, AlertTriangle, ShieldAlert, Heart, BatteryLow, WifiOff, Siren } from 'lucide-react';
import Link from 'next/link';
import type { Alert, AlertType } from '@/lib/supabase/types';

const TYPE_CONFIG: Record<AlertType, {
  icon: React.ReactNode;
  label: string;
  borderColor: string;
  iconBg: string;
}> = {
  GEOFENCE_EXIT:   { icon: <AlertTriangle className="w-4 h-4" />, label: 'Sortie de zone', borderColor: 'border-orange-500', iconBg: 'bg-orange-500' },
  TAMPER_DETECTED: { icon: <ShieldAlert className="w-4 h-4" />,   label: 'Sabotage détecté', borderColor: 'border-red-600',    iconBg: 'bg-red-600' },
  HEALTH_CRITICAL: { icon: <Heart className="w-4 h-4" />,          label: 'Santé critique',   borderColor: 'border-pink-500',   iconBg: 'bg-pink-500' },
  BATTERY_LOW:     { icon: <BatteryLow className="w-4 h-4" />,    label: 'Batterie faible',  borderColor: 'border-yellow-500', iconBg: 'bg-yellow-500' },
  SIGNAL_LOST:     { icon: <WifiOff className="w-4 h-4" />,       label: 'Signal perdu',     borderColor: 'border-gray-400',   iconBg: 'bg-gray-500' },
  PANIC_BUTTON:    { icon: <Siren className="w-4 h-4" />,         label: 'Bouton panique',   borderColor: 'border-red-700',    iconBg: 'bg-red-700' },
};

const SEVERITY_BG: Record<number, string> = {
  1: 'bg-white', 2: 'bg-white', 3: 'bg-white', 4: 'bg-red-50', 5: 'bg-red-50',
};

export default function AlertToast({ alert, onDismiss }: { alert: Alert; onDismiss: () => void }) {
  const cfg = TYPE_CONFIG[alert.alert_type];
  const caseNum = (alert.case as { case_number?: string } | undefined)?.case_number;

  return (
    <div
      className={`w-80 rounded-2xl shadow-2xl border-l-4 ${cfg.borderColor} ${SEVERITY_BG[alert.severity] ?? 'bg-white'} border border-gray-100 overflow-hidden`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`w-8 h-8 rounded-lg ${cfg.iconBg} text-white flex items-center justify-center flex-shrink-0`}>
            {cfg.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">{cfg.label}</p>
              <button
                onClick={onDismiss}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{alert.description}</p>
            <div className="flex items-center gap-3 mt-2">
              {caseNum && (
                <Link
                  href={`/sigep/dashboard/cases/${alert.case_id}`}
                  className="text-xs text-blue-600 hover:underline font-mono"
                >
                  {caseNum}
                </Link>
              )}
              <span className="text-[10px] text-gray-400">
                {new Date(alert.triggered_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              {alert.severity >= 4 && (
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">
                  Sév. {alert.severity}/5
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Severity pulse bar for critical alerts */}
      {alert.severity >= 4 && (
        <div className="h-1 bg-red-500 animate-pulse" />
      )}
    </div>
  );
}
