// Reverse geocoding via OpenStreetMap Nominatim.
// Used to label dwell stops with a human address in the itinerary view / report.
// Nominatim usage policy: <=1 req/s, identify via User-Agent, cache results.

const CACHE = new Map<string, string | null>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const stamps = new Map<string, number>();

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const UA = 'SIGEP-Horon/1.0 (electronic-monitoring; contact: admin@horon.bf)';

let lastCall = 0;
const MIN_INTERVAL_MS = 1100; // be polite — stay under 1 req/s

function key(lat: number, lng: number): string {
  // ~30m precision bucket so nearby points share a lookup
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

async function throttle(): Promise<void> {
  const wait = lastCall + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

/** Reverse-geocode one coordinate. Returns a short display address or null. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const k = key(lat, lng);
  const stamp = stamps.get(k);
  if (CACHE.has(k) && stamp && Date.now() - stamp < TTL_MS) {
    return CACHE.get(k) ?? null;
  }

  await throttle();
  try {
    const url = `${ENDPOINT}?lat=${lat}&lon=${lng}&format=jsonv2&zoom=18&addressdetails=1&accept-language=fr`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      // Nominatim can be slow; do not hang the request forever.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      CACHE.set(k, null);
      stamps.set(k, Date.now());
      return null;
    }
    const data = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const a = data.address ?? {};
    // Build a compact "road, neighbourhood, city" label, fall back to display_name.
    const parts = [
      a.road || a.pedestrian || a.suburb || a.neighbourhood,
      a.city || a.town || a.village || a.county,
    ].filter(Boolean);
    const label = parts.length ? parts.join(', ') : data.display_name ?? null;
    CACHE.set(k, label);
    stamps.set(k, Date.now());
    return label;
  } catch {
    CACHE.set(k, null);
    stamps.set(k, Date.now());
    return null;
  }
}

/** Reverse-geocode many coordinates sequentially (respects the rate limit). */
export async function reverseGeocodeMany(
  coords: Array<{ lat: number; lng: number }>,
  max = 40,
): Promise<(string | null)[]> {
  const out: (string | null)[] = [];
  for (let i = 0; i < coords.length; i++) {
    if (i >= max) {
      out.push(null);
      continue;
    }
    out.push(await reverseGeocode(coords[i].lat, coords[i].lng));
  }
  return out;
}
