// Référence comportementale — l'habitude de la personne, pas une règle générale.
//
// Une zone fixe dit « il est sorti du périmètre ». Elle ne dit pas « il n'est
// jamais là un mardi à trois heures ». Or c'est souvent cela qui compte : un
// changement d'habitude précède le manquement. Le système apprend donc où la
// personne se trouve d'ordinaire, heure par heure, et signale l'écart à SA
// propre habitude.
//
// Méthode volontairement explicable : découpage de l'espace en cellules d'à peu
// près 165 m, comptage par heure de la journée, et comparaison. Aucun modèle
// opaque — un magistrat doit pouvoir comprendre, et contester, ce qui lui est
// présenté.

export interface BasePoint { lat: number; lng: number; t: number }

// 0,0015° ≈ 165 m en latitude ; à la latitude de Ouagadougou l'écart en
// longitude est du même ordre. Assez fin pour distinguer deux quartiers, assez
// large pour absorber la dérive du GPS.
const CELL = 0.0015;

export const cellKey = (lat: number, lng: number): string =>
  `${Math.round(lat / CELL)}:${Math.round(lng / CELL)}`;

const cellCenter = (key: string): { lat: number; lng: number } => {
  const [a, b] = key.split(':').map(Number);
  return { lat: a * CELL, lng: b * CELL };
};

export function metersBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat), dLng = r(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface Profile {
  /** heure (0-23) → cellule → nombre de relevés */
  byHour: Map<number, Map<string, number>>;
  points: number;
  daysObserved: number;
  from: string | null;
  to: string | null;
}

// L'heure est celle du Burkina Faso, qui est aussi l'heure UTC : le pays vit à
// GMT toute l'année. Pas de conversion, donc pas d'erreur de conversion.
const hourOf = (t: number) => new Date(t).getUTCHours();

export function buildProfile(points: BasePoint[]): Profile {
  const byHour = new Map<number, Map<string, number>>();
  const days = new Set<string>();
  let from: number | null = null, to: number | null = null;

  for (const p of points) {
    const h = hourOf(p.t);
    const cells = byHour.get(h) ?? new Map<string, number>();
    const k = cellKey(p.lat, p.lng);
    cells.set(k, (cells.get(k) ?? 0) + 1);
    byHour.set(h, cells);
    days.add(new Date(p.t).toISOString().slice(0, 10));
    if (from === null || p.t < from) from = p.t;
    if (to === null || p.t > to) to = p.t;
  }

  return {
    byHour,
    points: points.length,
    daysObserved: days.size,
    from: from ? new Date(from).toISOString() : null,
    to: to ? new Date(to).toISOString() : null,
  };
}

export type BaselineVerdict = 'habituel' | 'inhabituel' | 'insuffisant';

export interface Assessment {
  verdict: BaselineVerdict;
  hour: number;
  /** Nombre de fois où la personne a déjà été vue dans cette cellule à cette heure. */
  seenHere: number;
  /** Distance au lieu habituel le plus proche pour cette heure, en mètres. */
  nearestKnownM: number | null;
  daysObserved: number;
  /** Phrase prête à afficher — le raisonnement doit rester lisible. */
  explanation: string;
}

// Seuils. Bas volontairement : mieux vaut se taire que crier au loup sur trois
// jours d'historique.
const MIN_DAYS = 7;
const MIN_POINTS = 200;
const FAMILIAR_HITS = 3;      // vu au moins trois fois ici à cette heure
const TOLERANCE_M = 300;      // marge autour des lieux connus de cette heure

export function assess(profile: Profile, point: BasePoint): Assessment {
  const hour = hourOf(point.t);
  const cells = profile.byHour.get(hour);
  const seenHere = cells?.get(cellKey(point.lat, point.lng)) ?? 0;

  let nearest: number | null = null;
  if (cells) {
    for (const key of cells.keys()) {
      const c = cellCenter(key);
      const d = metersBetween(point.lat, point.lng, c.lat, c.lng);
      if (nearest === null || d < nearest) nearest = Math.round(d);
    }
  }

  const base = { hour, seenHere, nearestKnownM: nearest, daysObserved: profile.daysObserved };

  if (profile.daysObserved < MIN_DAYS || profile.points < MIN_POINTS) {
    return {
      ...base, verdict: 'insuffisant',
      explanation: `Historique trop court pour juger : ${profile.daysObserved} jour(s) observé(s), il en faut ${MIN_DAYS}.`,
    };
  }

  if (seenHere >= FAMILIAR_HITS) {
    return {
      ...base, verdict: 'habituel',
      explanation: `Lieu habituel à cette heure — déjà relevé ${seenHere} fois vers ${hour} h.`,
    };
  }

  if (nearest !== null && nearest <= TOLERANCE_M) {
    return {
      ...base, verdict: 'habituel',
      explanation: `À ${nearest} m d'un lieu qu'il fréquente vers ${hour} h.`,
    };
  }

  return {
    ...base, verdict: 'inhabituel',
    explanation: nearest === null
      ? `Aucun relevé connu vers ${hour} h sur ${profile.daysObserved} jours — heure inhabituelle.`
      : `Jamais vu ici vers ${hour} h ; le lieu connu le plus proche est à ${nearest >= 1000 ? `${(nearest / 1000).toFixed(1)} km` : `${nearest} m`}.`,
  };
}
