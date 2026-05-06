// Ray-casting algorithm — O(n) where n = polygon vertices
export function pointInPolygon(
  lat: number,
  lon: number,
  polygon: number[][][] // GeoJSON ring: [[[lon, lat], ...]]
): boolean {
  const ring = polygon[0]; // outer ring only
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export interface GeofenceCheckResult {
  violated: boolean;
  geofenceId: string;
  geofenceName: string;
  isExclusion: boolean;
}

export function checkGeofences(
  lat: number,
  lon: number,
  geofences: Array<{
    id: string;
    name: string;
    is_exclusion: boolean;
    area: { coordinates: number[][][] };
  }>
): GeofenceCheckResult | null {
  for (const g of geofences) {
    const inside = pointInPolygon(lat, lon, g.area.coordinates);
    if (g.is_exclusion && inside) {
      return { violated: true, geofenceId: g.id, geofenceName: g.name, isExclusion: true };
    }
    if (!g.is_exclusion && !inside) {
      return { violated: true, geofenceId: g.id, geofenceName: g.name, isExclusion: false };
    }
  }
  return null;
}
