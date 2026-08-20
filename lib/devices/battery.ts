// Batterie prédictive.
//
// Alerter à 20 % dit ce qui est déjà vrai. Ce qui intéresse un opérateur, c'est
// quand le bracelet sera muet : « à plat vers 21 h » se traite dans la journée,
// « batterie faible » se traite quand il est trop tard.
//
// La pente de décharge est déjà en base (device_telemetry). On l'estime par
// moindres carrés sur la fenêtre récente, ce qui absorbe le bruit des relevés —
// une seule mesure basse ne doit pas annoncer une panne.

export interface TelemetryPoint { battery_pct: number | null; recorded_at: string }

export interface BatteryForecast {
  /** Pente en points de pourcentage par heure. Négative = décharge. */
  slopePctPerHour: number;
  /** Instant estimé du zéro, ou null si la charge monte ou stagne. */
  emptyAt: string | null;
  /** Heures restantes avant extinction, arrondies. */
  hoursLeft: number | null;
  /** true quand la charge monte : le bracelet est sur son socle. */
  charging: boolean;
  /** Nombre de relevés utilisés — sous 4, on n'annonce rien. */
  samples: number;
}

// Fenêtre d'observation : assez longue pour une pente stable, assez courte pour
// que le changement de régime récent (mode temps réel, recharge) l'emporte.
const WINDOW_MS = 6 * 3600_000;
const MIN_SAMPLES = 4;
// En dessous, la pente n'est que du bruit de mesure : le bracelet rapporte la
// charge au point de pourcentage entier.
const MIN_SLOPE = 0.15;

export function forecastBattery(points: TelemetryPoint[], nowMs = Date.now()): BatteryForecast | null {
  const pts = points
    .filter((p): p is { battery_pct: number; recorded_at: string } => p.battery_pct != null)
    .map((p) => ({ t: Date.parse(p.recorded_at), v: p.battery_pct }))
    .filter((p) => Number.isFinite(p.t) && nowMs - p.t <= WINDOW_MS)
    .sort((a, b) => a.t - b.t);

  if (pts.length < MIN_SAMPLES) return null;

  // Moindres carrés sur (heures écoulées, pourcentage).
  const t0 = pts[0].t;
  const xs = pts.map((p) => (p.t - t0) / 3600_000);
  const ys = pts.map((p) => p.v);
  const n = pts.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  if (den === 0) return null;
  const slope = num / den;

  const last = pts[pts.length - 1];
  const charging = slope > MIN_SLOPE;

  if (charging || slope > -MIN_SLOPE) {
    return { slopePctPerHour: slope, emptyAt: null, hoursLeft: null, charging, samples: n };
  }

  // Extrapolation depuis le DERNIER relevé, pas depuis la droite ajustée : la
  // charge réelle du moment prime sur le lissage.
  const hoursLeft = last.v / -slope;
  const emptyAt = new Date(last.t + hoursLeft * 3600_000).toISOString();
  return { slopePctPerHour: slope, emptyAt, hoursLeft: Math.round(hoursLeft * 10) / 10, charging: false, samples: n };
}

// Formulation courte pour l'interface. `null` quand il n'y a rien d'utile à
// dire — mieux vaut se taire que d'annoncer une extinction dans trois jours.
export function batteryForecastLabel(f: BatteryForecast | null, horizonHours = 24): string | null {
  if (!f) return null;
  if (f.charging) return 'En charge';
  if (f.hoursLeft == null || f.emptyAt == null || f.hoursLeft > horizonHours) return null;
  const at = new Date(f.emptyAt).toLocaleTimeString('fr-FR', {
    timeZone: 'Africa/Ouagadougou', hour: '2-digit', minute: '2-digit',
  });
  if (f.hoursLeft < 1) return `À plat dans moins d’une heure (vers ${at})`;
  return `À plat dans ~${Math.round(f.hoursLeft)} h, vers ${at}`;
}
