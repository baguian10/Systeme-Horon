'use client';

import {
  createContext, useCallback, useContext, useRef, useState, useEffect,
} from 'react';
import type { Alert, AlertType } from '@/lib/supabase/types';
import { useAlertFeed } from '@/hooks/useAlertFeed';
import AlertToast from './AlertToast';

interface ToastItem {
  id: string;
  alert: Alert;
  leaving: boolean;
}

interface ToastCtx {
  addToast: (alert: Alert) => void;
}

const ToastContext = createContext<ToastCtx>({ addToast: () => {} });
export const useToast = () => useContext(ToastContext);

const SEVERITY_THRESHOLD_PERSIST = 4; // severity >= 4 stays until dismissed
const AUTO_DISMISS_MS = 7000;

// Web Audio API — no external dependency
function playAlertSound(severity: number) {
  try {
    const ctx = new (window.AudioContext || (window as never)['webkitAudioContext'])();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (severity >= 5) {
      // Urgent: triple pulse at 880 Hz
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      for (let i = 0; i < 3; i++) {
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.25 + 0.05);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.25 + 0.18);
      }
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.85);
    } else if (severity >= 3) {
      // Warning: single tone at 660 Hz
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    }
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

// Browser Push Notification
async function requestPushNotification(alert: Alert) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'denied') return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  if (Notification.permission === 'granted' && alert.severity >= 4) {
    const LABELS: Partial<Record<AlertType, string>> = {
      TAMPER_DETECTED: '⚠️ Sabotage bracelet',
      GEOFENCE_EXIT: '📍 Sortie de zone',
      PANIC_BUTTON: '🆘 Bouton panique',
      HEALTH_CRITICAL: '❤️ Santé critique',
    };
    new Notification(LABELS[alert.alert_type] ?? '🔔 Alerte SIGEP', {
      body: alert.description ?? 'Intervention requise.',
      icon: '/favicon.ico',
      tag: alert.id,
    });
  }
}

let toastCounter = 0;

export default function AlertToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 350);
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const addToast = useCallback((alert: Alert) => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => [{ id, alert, leaving: false }, ...prev].slice(0, 6));

    playAlertSound(alert.severity);
    requestPushNotification(alert);

    if (alert.severity < SEVERITY_THRESHOLD_PERSIST) {
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
    }
  }, [dismiss]);

  useAlertFeed(addToast);

  // Cleanup timers on unmount
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast stack — bottom-right */}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col-reverse gap-3 pointer-events-none"
        style={{ maxWidth: 380 }}
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto transition-all duration-350 ${
              item.leaving
                ? 'opacity-0 translate-x-8'
                : 'opacity-100 translate-x-0'
            }`}
            style={{ transitionProperty: 'opacity, transform' }}
          >
            <AlertToast alert={item.alert} onDismiss={() => dismiss(item.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
