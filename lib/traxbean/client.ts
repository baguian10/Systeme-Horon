// Traxbean / ThinkRace cloud client.
//
// The TR40 ankle tracker pushes to the Traxbean platform (napi.5gcity.com),
// not directly to SIGEP. The platform exposes no public API to us, so we call
// the same authenticated endpoint its own web dashboard uses to read a device's
// latest position. We then poll it (Vercel Cron / external pinger) and feed the
// result into the standard /api/ingest/position pipeline.
//
// Auth: a long-lived JWT (no `exp` claim) sent verbatim in the Authorization
// header — captured from the platform session. Store it in TRAXBEAN_TOKEN.
//
// TLS note: napi.5gcity.com serves an INCOMPLETE certificate chain (missing
// intermediate), so the default fetch fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE.
// We use a dedicated undici dispatcher with verification relaxed, scoped to ONLY
// these requests — it never affects any other outbound traffic. Read-only
// location polling. TODO: harden by pinning the real intermediate CA.

import { request, Agent } from 'undici';

const API_BASE = process.env.TRAXBEAN_API_BASE ?? 'https://napi.5gcity.com';
const TOKEN = process.env.TRAXBEAN_TOKEN;

const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });

export type TraxbeanLocation = {
  imei: string;
  lat: number;
  lng: number;
  battery: number | null;     // percent 0-100
  signal: number | null;      // platform-specific strength
  speedKmh: number | null;
  locationType: number | null; // 1 = GPS
  recordedAt: string;          // ISO 8601
  address: string | null;
};

export function isTraxbeanConfigured(): boolean {
  return Boolean(TOKEN);
}

// Fetch the latest known position for one IMEI. Returns null on any failure
// (unconfigured token, network error, non-200 platform code, no data).
export async function getDeviceLocation(imei: string): Promise<TraxbeanLocation | null> {
  if (!TOKEN) return null;

  try {
    const res = await request(`${API_BASE}/admin/business/location/getDeviceLocationLK`, {
      method: 'POST',
      dispatcher,
      headers: {
        'Content-Type': 'application/json',
        Authorization: TOKEN,
      },
      body: JSON.stringify({ imei }),
    });

    if (res.statusCode < 200 || res.statusCode >= 300) {
      res.body.dump();
      return null;
    }

    const json = (await res.body.json()) as {
      code?: number;
      data?: {
        lat: number;
        lng: number;
        battery?: number;
        signal?: number;
        speed?: number;
        locationType?: number;
        utcTimestamp?: number; // epoch milliseconds
        address?: string;
      };
    };

    if (json?.code !== 200 || !json.data) return null;
    const d = json.data;
    if (typeof d.lat !== 'number' || typeof d.lng !== 'number') return null;

    return {
      imei,
      lat: d.lat,
      lng: d.lng,
      battery: d.battery ?? null,
      signal: d.signal ?? null,
      speedKmh: d.speed ?? null,
      locationType: d.locationType ?? null,
      recordedAt: d.utcTimestamp
        ? new Date(d.utcTimestamp).toISOString()
        : new Date().toISOString(),
      address: d.address || null,
    };
  } catch {
    return null;
  }
}
