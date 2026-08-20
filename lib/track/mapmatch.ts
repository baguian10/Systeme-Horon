// Recalage du trajet sur les routes.
//
// Le bracelet donne un point toutes les dix secondes au mieux : relier ces
// points par des segments droits coupe les virages et fait passer le trajet à
// travers les pâtés de maisons. Un moteur de recalage remet la trace sur le
// réseau routier réel et restitue les tournants.
//
// **Aucun service extérieur par défaut.** Envoyer les déplacements d'une
// personne sous mesure judiciaire à un serveur public serait une divulgation,
// quelle que soit sa commodité. Le recalage ne s'active donc que si le
// ministère héberge son propre moteur et renseigne OSRM_URL — typiquement une
// instance OSRM avec l'extrait OpenStreetMap du Burkina Faso. Sans cette
// variable, la trace reste brute et l'interface le dit.

export interface TrackPoint { lat: number; lng: number; t: number }

export function isMapMatchingConfigured(): boolean {
  return Boolean(process.env.OSRM_URL);
}

// Renvoie la géométrie recalée [[lat,lng], …], ou null si le recalage n'est pas
// configuré, échoue, ou n'a rien de mieux à proposer. L'appelant garde alors la
// trace brute : mieux vaut une ligne franche qu'un trajet inventé.
export async function snapToRoads(points: TrackPoint[]): Promise<[number, number][] | null> {
  const base = process.env.OSRM_URL;
  if (!base || points.length < 2) return null;

  // OSRM accepte cent points par appel ; au-delà on échantillonne
  // régulièrement, ce qui suffit à guider le recalage.
  const MAX = 100;
  const step = Math.ceil(points.length / MAX);
  const sample = points.filter((_, i) => i % step === 0);
  if (sample.length < 2) return null;

  const coords = sample.map((p) => `${p.lng},${p.lat}`).join(';');
  const stamps = sample.map((p) => Math.round(p.t / 1000)).join(';');
  // Rayon de tolérance : au-delà de cinquante mètres d'un axe, le point est
  // probablement hors route (cour, marché, piste) et ne doit pas être forcé.
  const radii = sample.map(() => '50').join(';');

  const url = `${base.replace(/\/$/, '')}/match/v1/driving/${coords}`
    + `?geometries=geojson&overview=full&tidy=true&timestamps=${stamps}&radiuses=${radii}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json() as {
      code?: string;
      matchings?: { geometry?: { coordinates?: [number, number][] } }[];
    };
    if (json.code !== 'Ok') return null;
    const line = json.matchings?.[0]?.geometry?.coordinates;
    if (!Array.isArray(line) || line.length < 2) return null;
    // GeoJSON est en (longitude, latitude) ; Leaflet attend l'inverse.
    return line.map(([lng, lat]) => [lat, lng] as [number, number]);
  } catch {
    return null; // moteur injoignable ou trop lent — trace brute
  }
}
