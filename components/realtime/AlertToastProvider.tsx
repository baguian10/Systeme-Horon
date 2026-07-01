'use client';

import {
  createContext, useCallback, useContext, useRef, useState, useEffect,
} from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { Alert, AlertType } from '@/lib/supabase/types';
import { useAlertFeed } from '@/hooks/useAlertFeed';
import AlertToast from './AlertToast';

const SOUND_KEY = 'sigep_alert_sound';

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

// Shared AudioContext — browsers block audio until the user has interacted
// with the page, so we keep ONE context and unlock/resume it on the first
// user gesture. Without this the alert sound silently never plays.
let sharedCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (!sharedCtx) sharedCtx = new (window.AudioContext || (window as never)['webkitAudioContext'])();
    if (sharedCtx.state === 'suspended') void sharedCtx.resume();
    return sharedCtx;
  } catch { return null; }
}
if (typeof window !== 'undefined') {
  const unlock = () => { getAudioCtx(); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

// Web Audio API — no external dependency. Louder, repeating siren for critical.
function playAlertSound(severity: number) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const beep = (freq: number, start: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.03);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.02);
    };
    if (severity >= 5) {
      // Critical: rising/falling siren, 4 sweeps
      for (let i = 0; i < 4; i++) { beep(740, i * 0.42, 0.18, 0.35); beep(990, i * 0.42 + 0.2, 0.18, 0.35); }
    } else if (severity >= 4) {
      // High: triple pulse 880 Hz
      for (let i = 0; i < 3; i++) beep(880, i * 0.26, 0.16, 0.3);
    } else if (severity >= 3) {
      // Warning: single tone
      beep(660, 0, 0.4, 0.18);
    }
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
      BLE_EXIT: '🏠 Sortie du domicile (BLE)',
      CURFEW_VIOLATION: '🌙 Couvre-feu non respecté',
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
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(true);

  // Load the saved sound preference (default on) once on mount.
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(SOUND_KEY) : null;
    const on = saved !== 'off';
    soundRef.current = on;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSoundOn(on);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      soundRef.current = next;
      try { window.localStorage.setItem(SOUND_KEY, next ? 'on' : 'off'); } catch {}
      if (next) { getAudioCtx(); playAlertSound(4); } // unlock + confirm tone
      return next;
    });
  }, []);

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

    if (soundRef.current) playAlertSound(alert.severity);
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
      {/* Sound on/off toggle — always visible, bottom-right above the toasts */}
      <button
        onClick={toggleSound}
        title={soundOn ? 'Alarme sonore activée — cliquer pour couper' : 'Alarme sonore coupée — cliquer pour activer'}
        className={`fixed bottom-5 right-5 z-50 flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg text-xs font-semibold transition-colors ${
          soundOn ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
        }`}
      >
        {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        {soundOn ? 'Son ON' : 'Son OFF'}
      </button>
      {/* Toast stack — bottom-right, above the toggle */}
      <div
        className="fixed bottom-20 right-5 z-50 flex flex-col-reverse gap-3 pointer-events-none"
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
