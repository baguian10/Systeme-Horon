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

// ── Generic admin call + commands + BLE home presence ───────────────────────
// Reverse-engineered from the Traxbean web app's own API map.

const DEPARTMENT_ID = Number(process.env.TRAXBEAN_DEPARTMENT_ID ?? '914');

async function traxbeanPost<T>(path: string, body: unknown): Promise<T | null> {
  if (!TOKEN) return null;
  try {
    const res = await request(`${API_BASE}/admin/${path}`, {
      method: 'POST',
      dispatcher,
      headers: { 'Content-Type': 'application/json', Authorization: TOKEN },
      body: JSON.stringify(body),
    });
    if (res.statusCode < 200 || res.statusCode >= 300) { res.body.dump(); return null; }
    const json = (await res.body.json()) as { code?: number; data?: T };
    if (json?.code !== 200) return null;
    return (json.data ?? null) as T | null;
  } catch {
    return null;
  }
}

// Map an IMEI to its Traxbean numeric targetId (needed by several endpoints).
// target/page returns { list: [...], pagination }.
export async function getTargetIdByImei(imei: string): Promise<number | null> {
  const data = await traxbeanPost<{ list?: Array<{ id: number; imei: string }> }>('business/target/page', { departmentId: DEPARTMENT_ID });
  const list = data?.list ?? [];
  return list.find((x) => x.imei === imei)?.id ?? null;
}

export type TraxbeanCommand =
  | 'locate'      // force an immediate position fix
  | 'enableBle'   // continuous BLE beacon scan (every 120s)
  | 'restart'     // reboot the bracelet
  | 'shutdown'    // power off (SUPER_ADMIN — cuts tracking)
  | 'setInterval' // GPS report interval (value = seconds)
  | 'realtime';   // intensive real-time tracking (10s interval)

const post = async (path: string, body: unknown) => (await traxbeanPost<number>(path, body)) !== null;

// Send a remote command to the bracelet. `value` is used by setInterval (seconds).
export async function sendDeviceCommand(imei: string, command: TraxbeanCommand, value?: number): Promise<boolean> {
  switch (command) {
    case 'locate':   return post('business/target/doPosition', { imei, param: '' });
    case 'restart':  return post('business/target/doRestart', { imei, param: '' });
    case 'shutdown': return post('business/target/doShutdown', { imei, param: '' });
    case 'realtime': return post('business/target/setPositionInterval', { imei, param: '10' });
    case 'setInterval': {
      const sec = Math.max(10, Math.min(86400, Math.round(Number(value) || 300)));
      return post('business/target/setPositionInterval', { imei, param: String(sec) });
    }
    case 'enableBle': {
      const targetId = await getTargetIdByImei(imei);
      if (!targetId) return false;
      // ThinkRace IW: >*ble@<sec>*< opens BLE + uploads an APBL scan every <sec>s.
      return post('business/target/sendCommand', { targetId, imei, command: '>*ble@120*<' });
    }
  }
  return false;
}

export type BleSighting = { name: string; mac: string; rssi: number };
export type BleScan = { at: string; sightings: BleSighting[] } | null;

// Parse the device's most recent APBL (BLE scan) packet from the raw log.
// APBL format: IWAPBL,IMEI, Name|MAC|RSSI&Name2|MAC2|RSSI2, terminalMAC, timestamp#
export async function getLatestBleScan(imei: string): Promise<BleScan> {
  const lines = await traxbeanPost<string[]>('business/device/fetchDeviceLog', {
    imei,
    startTime: new Date(Date.now() - 15 * 60000).toISOString(),
  });
  if (!Array.isArray(lines)) return null;
  const apbl = lines.filter((l) => typeof l === 'string' && l.includes('IWAPBL,'));
  if (apbl.length === 0) return null;

  const line = apbl[apbl.length - 1];
  const payload = line.slice(line.indexOf('IWAPBL,') + 'IWAPBL,'.length).replace(/#.*$/, '');
  // payload = IMEI , bledata , terminalMAC , timestamp   (MACs use ':' not ',')
  const parts = payload.split(',');
  if (parts.length < 4) return null;
  const bledata = parts[1];
  const ts = Number(parts[parts.length - 1]);
  const sightings: BleSighting[] = bledata.split('&').map((seg) => {
    const [name, mac, rssi] = seg.split('|');
    return { name: name ?? '', mac: (mac ?? '').trim().toUpperCase(), rssi: Number(rssi) };
  }).filter((s) => s.mac);

  return { at: ts ? new Date(ts).toISOString() : new Date().toISOString(), sightings };
}

export type DeviceConfigKind = 'sos' | 'timezoneBF' | 'strap' | 'apn';

// Device-level configuration (SUPER_ADMIN / technical).
export async function configureDevice(imei: string, kind: DeviceConfigKind, value?: string): Promise<boolean> {
  switch (kind) {
    case 'sos':        return post('business/target/setSOSNumber', { imei, param: String(value ?? '') });
    case 'timezoneBF': return post('business/target/setTimezone', { imei, timezone: 'Etc/GMT', lang: 10 }); // Burkina Faso = GMT
    case 'strap':      return post('business/target/setStrapAlarm', { imei, param: String(value ?? '5') });
    case 'apn': {
      const moov = value === 'moov';
      // Burkina Faso: Orange (613-02) / Moov (613-03), APN "internet".
      return post('business/device/updateDeviceInitConfig', { imei, apn: 'internet', mcc: 613, mnc: moov ? 3 : 2, apnUser: '', apnPass: '' });
    }
  }
  return false;
}

export type HomePresence = {
  configured: boolean;
  atHome: boolean;
  rssi: number | null;
  lastIndoorAt: string | null;
};

// BLE home presence: is the home beacon MAC present in the latest BLE scan?
export async function getHomePresence(imei: string): Promise<HomePresence> {
  const targetId = await getTargetIdByImei(imei);
  if (!targetId) return { configured: false, atHome: false, rssi: null, lastIndoorAt: null };

  const home = await traxbeanPost<{ macs?: string[] }>('business/target/getTargetHome', { id: targetId });
  const homeMacs = (home?.macs ?? []).map((m) => m.trim().toUpperCase());
  const configured = homeMacs.length > 0;
  if (!configured) return { configured: false, atHome: false, rssi: null, lastIndoorAt: null };

  const scan = await getLatestBleScan(imei);
  if (!scan) return { configured, atHome: false, rssi: null, lastIndoorAt: null };

  const hit = scan.sightings.find((s) => homeMacs.includes(s.mac));
  return {
    configured,
    atHome: Boolean(hit),
    rssi: hit ? hit.rssi : null,
    lastIndoorAt: scan.at,
  };
}
