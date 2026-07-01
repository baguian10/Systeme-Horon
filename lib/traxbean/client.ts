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
const STATIC_TOKEN = process.env.TRAXBEAN_TOKEN;          // legacy fallback
const USERNAME = process.env.TRAXBEAN_USERNAME;
const PASSWORD = process.env.TRAXBEAN_PASSWORD;

const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });

// ── Auto-renewing session token ──────────────────────────────────────────────
// The platform JWT is short-lived and, once expired, silently kills all device
// calls. When TRAXBEAN_USERNAME/PASSWORD are set we log in programmatically and
// cache the token, re-logging in on expiry. Falls back to the static token.
let cachedToken: string | null = null;
let cachedAt = 0;
const TOKEN_TTL_MS = 45 * 60_000; // refresh well before typical expiry

async function login(): Promise<string | null> {
  if (!USERNAME || !PASSWORD) return null;
  try {
    const res = await request(`${API_BASE}/admin/login`, {
      method: 'POST', dispatcher,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    const json = (await res.body.json().catch(() => null)) as { data?: { token?: string } } | null;
    const token = json?.data?.token;
    if (token) { cachedToken = token; cachedAt = Date.now(); return token; }
    return null;
  } catch { return null; }
}

// Current auth token: cached login token, a fresh login, or the static token.
async function getToken(forceRefresh = false): Promise<string | null> {
  if (USERNAME && PASSWORD) {
    if (!forceRefresh && cachedToken && Date.now() - cachedAt < TOKEN_TTL_MS) return cachedToken;
    const t = await login();
    return t ?? cachedToken ?? STATIC_TOKEN ?? null;
  }
  return STATIC_TOKEN ?? null;
}

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
  return Boolean((USERNAME && PASSWORD) || STATIC_TOKEN);
}

export type TraxbeanAuth = 'ok' | 'expired' | 'unconfigured' | 'unreachable';

// Lightweight auth probe: the platform returns { message: "Login identity has
// expired" } (or a non-200 business code) once the captured JWT is invalidated.
// Distinguishes an expired token from a network failure or a device with no fix.
export async function checkTraxbeanAuth(): Promise<TraxbeanAuth> {
  if (!isTraxbeanConfigured()) return 'unconfigured';
  const token = await getToken(true); // force a fresh login when possible
  if (!token) return 'expired';
  try {
    const res = await request(`${API_BASE}/admin/business/target/page`, {
      method: 'POST', dispatcher,
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ departmentId: DEPARTMENT_ID, pageNum: 1, pageSize: 1 }),
    });
    const json = (await res.body.json().catch(() => null)) as { code?: number; message?: string } | null;
    if (!json) return 'unreachable';
    const msg = (json.message ?? '').toLowerCase();
    if (msg.includes('expired') || msg.includes('login') || msg.includes('token') || msg.includes('unauthor')) return 'expired';
    if (json.code === 200) return 'ok';
    // Any other non-200 business code with no auth wording → treat as expired/denied.
    return 'expired';
  } catch {
    return 'unreachable';
  }
}

// Fetch the latest known position for one IMEI. Returns null on any failure
// (unconfigured token, network error, non-200 platform code, no data).
export async function getDeviceLocation(imei: string): Promise<TraxbeanLocation | null> {
  let token = await getToken();
  if (!token) return null;

  try {
    let res = await request(`${API_BASE}/admin/business/location/getDeviceLocationLK`, {
      method: 'POST', dispatcher,
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ imei }),
    });
    let json = (await res.body.json().catch(() => null)) as { code?: number; message?: string; data?: Record<string, unknown> } | null;
    // Token expired mid-flight → re-login once and retry.
    if (json && (json.message ?? '').toLowerCase().includes('expired')) {
      token = await getToken(true);
      if (token) {
        res = await request(`${API_BASE}/admin/business/location/getDeviceLocationLK`, {
          method: 'POST', dispatcher,
          headers: { 'Content-Type': 'application/json', Authorization: token },
          body: JSON.stringify({ imei }),
        });
        json = (await res.body.json().catch(() => null)) as typeof json;
      }
    }

    if (res.statusCode < 200 || res.statusCode >= 300 || !json) {
      return null;
    }

    const d = json.data as {
      lat?: number; lng?: number; battery?: number; signal?: number;
      speed?: number; locationType?: number; utcTimestamp?: number | string; address?: string;
    } | undefined;
    if (!d || typeof d.lat !== 'number' || typeof d.lng !== 'number') return null;

    return {
      imei,
      lat: d.lat,
      lng: d.lng,
      battery: d.battery ?? null,
      signal: d.signal ?? null,
      speedKmh: d.speed ?? null,
      locationType: d.locationType ?? null,
      recordedAt: d.utcTimestamp
        ? new Date(Number(d.utcTimestamp)).toISOString()
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
  let token = await getToken();
  if (!token) return null;
  const call = async (tok: string) => {
    const res = await request(`${API_BASE}/admin/${path}`, {
      method: 'POST', dispatcher,
      headers: { 'Content-Type': 'application/json', Authorization: tok },
      body: JSON.stringify(body),
    });
    return (await res.body.json().catch(() => null)) as { code?: number; message?: string; data?: T } | null;
  };
  try {
    let json = await call(token);
    // Expired token mid-flight → re-login once and retry.
    if (json && (json.message ?? '').toLowerCase().includes('expired')) {
      token = (await getToken(true)) ?? '';
      if (token) json = await call(token);
    }
    if (!json || json.code !== 200) return null;
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

// BP17 — factory reset (wipes SOS/whitelist/home config of a previous wearer
// before a bracelet is reassigned). IWBP17,IMEI,serial#
export async function factoryReset(imei: string): Promise<boolean> {
  return sendIW(imei, `IWBP17,${imei},${cmdSerial()}#`);
}

// BP19 — point the bracelet at the SIGEP ingestion server (onboarding a new
// device). IWBP19,IMEI,serial,DomainFlag,IP/domain,port#  (flag 1=domain, 0=IP)
export async function setServer(imei: string, host: string, port: number, isDomain = true): Promise<boolean> {
  const p = Math.max(1, Math.min(65535, Math.round(port) || 8011));
  return sendIW(imei, `IWBP19,${imei},${cmdSerial()},${isDomain ? 1 : 0},${host},${p}#`);
}

export type HealthReading = { type: 'BLOOD_PRESSURE' | 'HEART_RATE' | 'BODY_TEMP' | 'BLOOD_OXYGEN'; value: string; at: string };
const HEALTH_TYPES: Record<string, HealthReading['type']> = { '1': 'BLOOD_PRESSURE', '2': 'HEART_RATE', '3': 'BODY_TEMP', '4': 'BLOOD_OXYGEN' };

// Latest health reading from the device log. APJK: IWAPJK,Datetime,Type,Value#
// Type 1=blood pressure, 2=heart rate, 3=body temperature, 4=blood oxygen.
export async function getLatestHealth(imei: string): Promise<HealthReading | null> {
  const lines = await traxbeanPost<string[]>('business/device/fetchDeviceLog', {
    imei, startTime: new Date(Date.now() - 30 * 60000).toISOString(),
  });
  if (!Array.isArray(lines)) return null;
  const jk = lines.filter((l) => typeof l === 'string' && l.includes('APJK'));
  if (jk.length === 0) return null;
  const line = jk[jk.length - 1];
  const m = /APJK,\s*[^,]+,\s*([1-4])\s*,\s*([^#,]+)/.exec(line);
  if (!m) return null;
  return { type: HEALTH_TYPES[m[1]], value: m[2].trim(), at: new Date().toISOString() };
}

// BP40 shortcut relay (same path as enableBle): >*keyword@value*<
async function sendShortcut(imei: string, shortcut: string): Promise<boolean> {
  const targetId = await getTargetIdByImei(imei);
  if (!targetId) return false;
  return post('business/target/sendCommand', { targetId, imei, command: shortcut });
}

// Fall detection (>*fall@1|0*<) + sensitivity (>*fallconfig@<threshold>*<; smaller =
// more sensitive; the "falling trend" must exceed the threshold to alarm).
export async function setFallAlarm(imei: string, on: boolean): Promise<boolean> {
  return sendShortcut(imei, `>*fall@${on ? 1 : 0}*<`);
}
export async function setFallSensitivity(imei: string, threshold: number): Promise<boolean> {
  const t = Math.max(100, Math.min(5000, Math.round(threshold) || 1000));
  return sendShortcut(imei, `>*fallconfig@${t}*<`);
}
// Wearing-status detection (>*wearconfig@1|0*<). When on, the device reports
// APWR (1 = worn on body, 0 = removed) — the anti-removal signal.
export async function setWearingDetection(imei: string, on: boolean): Promise<boolean> {
  return sendShortcut(imei, `>*wearconfig@${on ? 1 : 0}*<`);
}

// Latest wearing status from the device log. APWR line: IWAPWR,IMEI,flag#
// flag 1 = worn on body, 0 = removed. null = no APWR seen (unknown).
export async function getWearingStatus(imei: string): Promise<{ worn: boolean; at: string } | null> {
  const lines = await traxbeanPost<string[]>('business/device/fetchDeviceLog', {
    imei,
    startTime: new Date(Date.now() - 30 * 60000).toISOString(),
  });
  if (!Array.isArray(lines)) return null;
  const wr = lines.filter((l) => typeof l === 'string' && l.includes('APWR'));
  if (wr.length === 0) return null;
  const line = wr[wr.length - 1];
  const m = /APWR,\s*\d+\s*,\s*([01])/.exec(line);
  if (!m) return null;
  return { worn: m[1] === '1', at: new Date().toISOString() };
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

// ── Voice communication (ThinkRace IW protocol, raw downlink commands) ──
// Sent via Traxbean's generic sendCommand relay (same path as the BLE command).
const cmdSerial = () => String(Date.now()).slice(-6);

async function sendIW(imei: string, command: string): Promise<boolean> {
  const targetId = await getTargetIdByImei(imei);
  if (!targetId) return false;
  return post('business/target/sendCommand', { targetId, imei, command });
}

// BP12 — up to 3 SOS numbers the bracelet dials when the SOS button is pressed.
export async function setSosNumbers(imei: string, numbers: string[]): Promise<boolean> {
  const n = numbers.map((x) => x.trim()).filter(Boolean).slice(0, 3);
  while (n.length < 3) n.push('');
  return sendIW(imei, `IWBP12,${imei},${cmdSerial()},${n.join(',')}#`);
}

// BP14 — white list of authorised contacts (Name|Phone) allowed to call/command.
export async function setWhitelist(imei: string, contacts: { name: string; phone: string }[]): Promise<boolean> {
  const pairs = contacts
    .filter((c) => c.phone?.trim())
    .slice(0, 5)
    .map((c) => `${(c.name || '').trim()}|${c.phone.trim()}`);
  return sendIW(imei, `IWBP14,${imei},${cmdSerial()},${pairs.join(',')}#`);
}

// BPPH — enable/disable inbound/outbound phone calls on the bracelet.
export async function setPhoneCallSwitch(imei: string, on: boolean): Promise<boolean> {
  return sendIW(imei, `IWBPPH,${imei},${cmdSerial()},${on ? 1 : 0}#`);
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
