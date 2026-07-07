'use client';

import type { AlertType } from '@/lib/supabase/types';

// ── Alert sound engine (Web Audio, no assets) ────────────────────────────────
// Sounds are synthesized so they work offline and weigh nothing. Preferences
// are per alert type, stored client-side (each operator tunes their own post).

export type SoundKind = 'police' | 'wail' | 'beeps' | 'chime' | 'off';

export const SOUND_LABELS: Record<SoundKind, string> = {
  police: 'Sirène police (2 s)',
  wail:   'Sirène montante (2 s)',
  beeps:  'Bips répétés',
  chime:  'Carillon discret',
  off:    'Silencieux',
};

export interface AlertSoundPrefs {
  [type: string]: { enabled: boolean; sound: SoundKind };
}

const PREFS_KEY = 'sigep_alert_sound_prefs';

export const DEFAULT_PREFS: AlertSoundPrefs = {
  GEOFENCE_EXIT:    { enabled: true, sound: 'police' },
  BLE_EXIT:         { enabled: true, sound: 'police' },
  CURFEW_VIOLATION: { enabled: true, sound: 'police' },
  TAMPER_DETECTED:  { enabled: true, sound: 'police' },
  PANIC_BUTTON:     { enabled: true, sound: 'wail' },
  HEALTH_CRITICAL:  { enabled: true, sound: 'wail' },
  BATTERY_LOW:      { enabled: true, sound: 'beeps' },
  SIGNAL_LOST:      { enabled: false, sound: 'chime' },
};

export function getSoundPrefs(): AlertSoundPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const saved = JSON.parse(raw) as AlertSoundPrefs;
    return { ...DEFAULT_PREFS, ...saved };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function setSoundPrefs(prefs: AlertSoundPrefs) {
  try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
}

// Shared AudioContext — browsers block audio until a user gesture; keep ONE
// context and resume it on the first interaction.
let sharedCtx: AudioContext | null = null;
export function getAudioCtx(): AudioContext | null {
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

export function playSound(kind: SoundKind) {
  if (kind === 'off') return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime;
    if (kind === 'police') {
      // European hi-lo two-tone: 660/470 Hz, 4 × 0.5 s = 2 s.
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 2400;
      osc.type = 'sawtooth';
      osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      for (let i = 0; i < 4; i++) osc.frequency.setValueAtTime(i % 2 === 0 ? 660 : 470, t0 + i * 0.5);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.32, t0 + 0.04);
      gain.gain.setValueAtTime(0.32, t0 + 1.88);
      gain.gain.linearRampToValueAtTime(0, t0 + 2);
      osc.start(t0); osc.stop(t0 + 2.05);
    } else if (kind === 'wail') {
      // US-style wail: continuous sweep 600↔1300 Hz, 2 cycles over 2 s.
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 2600;
      osc.type = 'sawtooth';
      osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(600, t0);
      osc.frequency.linearRampToValueAtTime(1300, t0 + 0.5);
      osc.frequency.linearRampToValueAtTime(600, t0 + 1.0);
      osc.frequency.linearRampToValueAtTime(1300, t0 + 1.5);
      osc.frequency.linearRampToValueAtTime(600, t0 + 2.0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.3, t0 + 0.04);
      gain.gain.setValueAtTime(0.3, t0 + 1.88);
      gain.gain.linearRampToValueAtTime(0, t0 + 2);
      osc.start(t0); osc.stop(t0 + 2.05);
    } else if (kind === 'beeps') {
      // Triple pulse 880 Hz.
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        const s = t0 + i * 0.26;
        gain.gain.setValueAtTime(0, s);
        gain.gain.linearRampToValueAtTime(0.3, s + 0.03);
        gain.gain.linearRampToValueAtTime(0, s + 0.16);
        osc.start(s); osc.stop(s + 0.2);
      }
    } else if (kind === 'chime') {
      // Two-note soft chime (sine, C6 → G5).
      const notes = [[1046.5, 0], [784, 0.18]] as const;
      for (const [freq, at] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq;
        const s = t0 + at;
        gain.gain.setValueAtTime(0, s);
        gain.gain.linearRampToValueAtTime(0.22, s + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, s + 0.6);
        osc.start(s); osc.stop(s + 0.65);
      }
    }
  } catch {}
}

/** Play the configured sound for an alert type (respects per-type prefs). */
export function playForAlertType(type: AlertType) {
  const prefs = getSoundPrefs();
  const p = prefs[type] ?? { enabled: true, sound: 'beeps' as SoundKind };
  if (!p.enabled) return;
  playSound(p.sound);
}
