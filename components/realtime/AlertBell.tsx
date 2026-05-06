'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import type { Alert, AlertType } from '@/lib/supabase/types';
import { useAlertFeed } from '@/hooks/useAlertFeed';

const TYPE_LABELS: Record<AlertType, string> = {
  GEOFENCE_EXIT: 'Sortie de zone', TAMPER_DETECTED: 'Sabotage',
  HEALTH_CRITICAL: 'Santé critique', BATTERY_LOW: 'Batterie faible',
  SIGNAL_LOST: 'Signal perdu', PANIC_BUTTON: 'Bouton panique',
};

export default function AlertBell() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [shake, setShake] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useAlertFeed((alert) => {
    setAlerts((prev) => [alert, ...prev].slice(0, 20));
    setUnread((n) => n + 1);
    setShake(true);
    setTimeout(() => setShake(false), 600);
  });

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function markAllRead() { setUnread(0); }
  function toggle() {
    setOpen((o) => !o);
    if (!open) setUnread(0);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggle}
        className={`relative p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors ${shake ? 'animate-bounce' : ''}`}
        aria-label="Alertes"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Alertes récentes
            </h3>
            <div className="flex items-center gap-2">
              {alerts.length > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Lu
                </button>
              )}
              <Link
                href="/sigep/dashboard/alerts"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => setOpen(false)}
              >
                Tout voir
              </Link>
            </div>
          </div>

          {/* Alert list */}
          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Bell className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Aucune alerte récente</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {alerts.map((alert, i) => (
                  <li key={alert.id + i}>
                    <Link
                      href={`/sigep/dashboard/cases/${alert.case_id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        alert.severity >= 5 ? 'bg-red-600' :
                        alert.severity >= 4 ? 'bg-red-400' :
                        alert.severity >= 3 ? 'bg-orange-400' : 'bg-yellow-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-900">{TYPE_LABELS[alert.alert_type]}</p>
                        <p className="text-[11px] text-gray-500 truncate">{alert.description}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(alert.triggered_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
