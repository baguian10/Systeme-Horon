import type { Position, Alert, AlertType, CaseStatus } from '@/lib/supabase/types';
import { MOCK_CASES, MOCK_POSITIONS, MOCK_ALERTS } from '@/lib/mock/data';

export interface SimulatedPosition extends Position {
  case_number: string;
  status: CaseStatus;
  alert_count: number;
}

export interface SimulatorEvent {
  type: 'position' | 'alert' | 'device_status';
  payload: SimulatedPosition | Alert | { device_id: string; is_online: boolean; battery_pct: number };
}

type SimulatorListener = (event: SimulatorEvent) => void;

// Small random walk — stays within ~2km of Bamako center
function jitter(val: number, scale = 0.002): number {
  return val + (Math.random() - 0.5) * scale;
}

class SimulatorEngine {
  private listeners: Set<SimulatorListener> = new Set();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private positions: Map<string, SimulatedPosition> = new Map();
  private alertSequence = 0;
  private speedMultiplier = 1;
  private running = false;

  constructor() {
    // Seed from mock data
    MOCK_CASES.filter((c) => c.status === 'ACTIVE' || c.status === 'VIOLATION').forEach((c, i) => {
      const seed = MOCK_POSITIONS[i];
      if (!seed || !c.device) return;
      this.positions.set(c.id, {
        id: `sim-${c.id}`,
        device_id: c.device.id,
        case_id: c.id,
        latitude: seed.latitude,
        longitude: seed.longitude,
        accuracy_m: 8,
        speed_kmh: 0,
        recorded_at: new Date().toISOString(),
        case_number: c.case_number,
        status: c.status,
        alert_count: c.alert_count ?? 0,
      });
    });
  }

  subscribe(listener: SimulatorListener): () => void {
    this.listeners.add(listener);
    // Immediately emit current positions
    this.positions.forEach((pos) => listener({ type: 'position', payload: pos }));
    return () => this.listeners.delete(listener);
  }

  private emit(event: SimulatorEvent) {
    this.listeners.forEach((l) => l(event));
  }

  start(speedMultiplier = 1) {
    if (this.running) return;
    this.running = true;
    this.speedMultiplier = speedMultiplier;
    const interval = Math.max(3000, 8000 / speedMultiplier);

    this.intervalId = setInterval(() => {
      // Move each device
      this.positions.forEach((pos, caseId) => {
        const updated: SimulatedPosition = {
          ...pos,
          id: `sim-${Date.now()}-${caseId}`,
          latitude: jitter(pos.latitude),
          longitude: jitter(pos.longitude),
          speed_kmh: Math.random() * 15,
          recorded_at: new Date().toISOString(),
        };
        this.positions.set(caseId, updated);
        this.emit({ type: 'position', payload: updated });
      });

      // Randomly generate alert (5% chance per tick)
      if (Math.random() < 0.05) {
        this.injectAlert();
      }

      // Randomly vary battery (drift down slowly)
      if (Math.random() < 0.1) {
        const cases = Array.from(this.positions.values());
        const pick = cases[Math.floor(Math.random() * cases.length)];
        if (pick) {
          this.emit({
            type: 'device_status',
            payload: {
              device_id: pick.device_id,
              is_online: true,
              battery_pct: Math.max(5, 78 - Math.floor(Math.random() * 20)),
            },
          });
        }
      }
    }, interval);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.running = false;
    this.intervalId = null;
  }

  setSpeed(multiplier: number) {
    this.speedMultiplier = multiplier;
    if (this.running) { this.stop(); this.start(multiplier); }
  }

  injectAlert(type?: AlertType) {
    const alertTypes: AlertType[] = [
      'GEOFENCE_EXIT', 'TAMPER_DETECTED', 'HEALTH_CRITICAL', 'BATTERY_LOW', 'SIGNAL_LOST',
    ];
    const chosenType = type ?? alertTypes[Math.floor(Math.random() * alertTypes.length)];
    const positions = Array.from(this.positions.values());
    if (positions.length === 0) return;
    const pos = positions[Math.floor(Math.random() * positions.length)];

    const SEVERITY_MAP: Record<AlertType, number> = {
      TAMPER_DETECTED: 5, PANIC_BUTTON: 5,
      GEOFENCE_EXIT: 4, HEALTH_CRITICAL: 3,
      SIGNAL_LOST: 3, BATTERY_LOW: 2,
    };
    const DESCRIPTION_MAP: Record<AlertType, string> = {
      GEOFENCE_EXIT: `Sortie de zone autorisée détectée à ${new Date().toLocaleTimeString('fr-FR')}.`,
      TAMPER_DETECTED: 'Tentative de retrait du bracelet. Intervention requise.',
      HEALTH_CRITICAL: 'Rythme cardiaque anormal détecté. Vérification médicale recommandée.',
      BATTERY_LOW: 'Batterie critique — rechargement requis sous 4 heures.',
      SIGNAL_LOST: 'Perte de signal GPS. Dernière position connue conservée.',
      PANIC_BUTTON: 'Bouton panique activé. Intervention immédiate requise.',
    };

    const alert: Alert = {
      id: `sim-alert-${++this.alertSequence}`,
      case_id: pos.case_id,
      device_id: pos.device_id,
      alert_type: chosenType,
      severity: SEVERITY_MAP[chosenType] ?? 3,
      description: DESCRIPTION_MAP[chosenType],
      position_lat: pos.latitude,
      position_lon: pos.longitude,
      is_resolved: false,
      resolved_by: null,
      resolved_at: null,
      triggered_at: new Date().toISOString(),
      case: { case_number: pos.case_number } as never,
    };

    this.emit({ type: 'alert', payload: alert });
  }

  isRunning() { return this.running; }
  getPositions() { return Array.from(this.positions.values()); }
}

// Singleton — one engine per browser tab
let _engine: SimulatorEngine | null = null;

export function getSimulatorEngine(): SimulatorEngine {
  if (!_engine) _engine = new SimulatorEngine();
  return _engine;
}
