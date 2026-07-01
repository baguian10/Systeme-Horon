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

// DB-backed token cache: serverless invocations don't share module memory, so
// the token is persisted on system_settings and reused across every function
// instance. Without this each poll would re-login and the account gets locked.
async function readDbToken(): Promise<{ token: string; at: number } | null> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (!sb) return null;
    const { data } = await sb.from('system_settings').select('traxbean_token, traxbean_token_at').eq('id', 1).maybeSingle();
    const row = data as { traxbean_token?: string | null; traxbean_token_at?: string | null } | null;
    if (row?.traxbean_token && row.traxbean_token_at) return { token: row.traxbean_token, at: Date.parse(row.traxbean_token_at) };
    return null;
  } catch { return null; }
}
async function writeDbToken(token: string): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (sb) await sb.from('system_settings').update({ traxbean_token: token, traxbean_token_at: new Date().toISOString(), traxbean_login_fail_at: null }).eq('id', 1);
  } catch { /* best effort */ }
}

// Login backoff: after a failed /admin/login, wait before retrying so a frequent
// cron can't hammer the endpoint and extend a rate-limit lockout.
const LOGIN_BACKOFF_MS = 5 * 60_000;
async function loginBackedOff(): Promise<boolean> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (!sb) return false;
    const { data } = await sb.from('system_settings').select('traxbean_login_fail_at').eq('id', 1).maybeSingle();
    const failAt = (data as { traxbean_login_fail_at?: string | null } | null)?.traxbean_login_fail_at;
    return Boolean(failAt) && Date.now() - Date.parse(failAt!) < LOGIN_BACKOFF_MS;
  } catch { return false; }
}
async function markLoginFail(): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const sb = createAdminClient();
    if (sb) await sb.from('system_settings').update({ traxbean_login_fail_at: new Date().toISOString() }).eq('id', 1);
  } catch { /* best effort */ }
}

async function login(): Promise<string | null> {
  if (!USERNAME || !PASSWORD) return null;
  if (await loginBackedOff()) return null; // within cooldown after a failure
  try {
    const res = await request(`${API_BASE}/admin/login`, {
      method: 'POST', dispatcher,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    const json = (await res.body.json().catch(() => null)) as { data?: { token?: string } } | null;
    const token = json?.data?.token;
    if (token) { cachedToken = token; cachedAt = Date.now(); await writeDbToken(token); return token; }
    await markLoginFail();
    return null;
  } catch { await markLoginFail(); return null; }
}

// Current auth token: module cache → DB cache → fresh login → static token.
// Only logs in when both caches are stale, so at most one login per TTL across
// all serverless instances.
async function getToken(forceRefresh = false): Promise<string | null> {
  if (USERNAME && PASSWORD) {
    // Even on forceRefresh, reuse a token minted in the last 10s — a sibling
    // call in the same poll just re-logged in (avoids N logins on N expiries).
    if (cachedToken && Date.now() - cachedAt < (forceRefresh ? 10_000 : TOKEN_TTL_MS)) return cachedToken;
    if (!forceRefresh) {
      const db = await readDbToken();
      if (db && Date.now() - db.at < TOKEN_TTL_MS) { cachedToken = db.token; cachedAt = db.at; return db.token; }
    }
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
  // Reuse the cached token (logs in only when the cache is empty/stale — at most
  // once per TTL). Forcing a fresh login every poll gets the account locked out.
  if (USERNAME && PASSWORD) {
    const t = await getToken();
    return t ? 'ok' : 'expired';
  }
  // Static-token only: probe a real position call and read the auth wording.
  try {
    const res = await request(`${API_BASE}/admin/business/location/getDeviceLocationLK`, {
      method: 'POST', dispatcher,
      headers: { 'Content-Type': 'application/json', Authorization: STATIC_TOKEN! },
      body: JSON.stringify({ imei: process.env.TRAXBEAN_DEMO_IMEI ?? '0' }),
    });
    const json = (await res.body.json().catch(() => null)) as { code?: number; message?: string; data?: unknown } | null;
    if (!json) return 'unreachable';
    const msg = (json.message ?? '').toLowerCase();
    if (msg.includes('expired') || msg.includes('login') || msg.includes('unauthor')) return 'expired';
    return json.data ? 'ok' : 'expired';
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

// Raw call with token + one expiry retry. Returns the parsed platform envelope.
async function traxbeanCall<T>(path: string, body: unknown): Promise<{ code?: number; message?: string; data?: T } | null> {
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
    return json;
  } catch {
    return null;
  }
}

// Returns the data payload (null on failure). Use when the caller needs data.
async function traxbeanPost<T>(path: string, body: unknown): Promise<T | null> {
  const json = await traxbeanCall<T>(path, body);
  if (!json || json.code !== 200) return null;
  return (json.data ?? null) as T | null;
}

// Returns true when the platform accepts a command (code 200) — regardless of
// whether it returns a data payload. Command endpoints like
// updateDeviceInitConfig reply { code:200, message:"success" } with NO data, so
// keying success off `data` (as before) wrongly reported them as failed.
async function traxbeanOk(path: string, body: unknown): Promise<boolean> {
  const json = await traxbeanCall<unknown>(path, body);
  return json?.code === 200;
}

// Map an IMEI to its Traxbean numeric targetId (needed by several endpoints).
// target/page returns { list: [...], pagination }. departmentId 0 is the root
// scope (returns all devices), so this doesn't depend on TRAXBEAN_DEPARTMENT_ID
// being set correctly — a wrong dept was making enableBle report the command as
// "not transmitted" (targetId not found). Fall back to the configured dept.
export async function getTargetIdByImei(imei: string): Promise<number | null> {
  for (const departmentId of [0, DEPARTMENT_ID]) {
    const data = await traxbeanPost<{ list?: Array<{ id: number; imei: string }> }>('business/target/page', { departmentId });
    const hit = (data?.list ?? []).find((x) => x.imei === imei);
    if (hit) return hit.id;
  }
  return null;
}

// Wearing status from the platform's target `wear` field:
//   1 = worn on body, 0 = removed, -1/absent = detection not active/unknown.
// More reliable than parsing APWR from the raw log.
export async function getDeviceWearStatus(imei: string): Promise<boolean | null> {
  const data = await traxbeanPost<{ list?: Array<{ imei: string; wear?: number }> }>('business/target/page', { departmentId: 0 });
  const hit = (data?.list ?? []).find((x) => x.imei === imei);
  if (!hit || hit.wear == null || hit.wear < 0) return null;
  return hit.wear === 1;
}

export type TraxbeanCommand =
  | 'locate'      // force an immediate position fix
  | 'enableBle'   // continuous BLE beacon scan (every 120s)
  | 'restart'     // reboot the bracelet
  | 'shutdown'    // power off (SUPER_ADMIN — cuts tracking)
  | 'setInterval' // GPS report interval (value = seconds)
  | 'realtime';   // intensive real-time tracking (10s interval)

const post = async (path: string, body: unknown) => traxbeanOk(path, body);

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

// Parse BLE scans from the raw log. APBL scans are intermittent — some cycles
// come back empty even while a beacon is in range — so we AGGREGATE the scans
// over a recent window and keep the strongest RSSI per MAC. Taking only the last
// packet would falsely report a beacon as absent (→ false home-exit alarm).
// Window is generous (10 min) because a low-power beacon can advertise as slowly
// as every ~5 s while the tracker only scans in short bursts, so it's caught
// only intermittently — seen anywhere in the window counts as present.
// APBL format: IWAPBL,IMEI, Name|MAC|RSSI&Name2|MAC2|RSSI2, terminalMAC, timestamp#
const BLE_WINDOW_MS = 10 * 60000;
export async function getLatestBleScan(imei: string): Promise<BleScan> {
  const lines = await traxbeanPost<string[]>('business/device/fetchDeviceLog', {
    imei,
    startTime: new Date(Date.now() - 15 * 60000).toISOString(),
  });
  if (!Array.isArray(lines)) return null;
  const apbl = lines.filter((l) => typeof l === 'string' && l.includes('IWAPBL,'));
  if (apbl.length === 0) return null;

  // Strongest sighting per MAC across the window; track the newest packet time.
  const best = new Map<string, BleSighting>();
  let newestTs = 0;
  const nowMs = Date.now();
  for (const line of apbl) {
    const payload = line.slice(line.indexOf('IWAPBL,') + 'IWAPBL,'.length).replace(/#.*$/, '');
    const parts = payload.split(','); // IMEI, bledata, terminalMAC, timestamp
    if (parts.length < 4) continue;
    const ts = Number(parts[parts.length - 1]);
    if (ts && nowMs - ts > BLE_WINDOW_MS) continue; // outside the aggregation window
    if (ts > newestTs) newestTs = ts;
    for (const seg of parts[1].split('&')) {
      const [name, mac, rssi] = seg.split('|');
      const m = (mac ?? '').trim().toUpperCase();
      const r = Number(rssi);
      if (!m || Number.isNaN(r)) continue;
      const prev = best.get(m);
      if (!prev || r > prev.rssi) best.set(m, { name: name ?? '', mac: m, rssi: r });
    }
  }
  if (best.size === 0 && newestTs === 0) return null;
  return { at: newestTs ? new Date(newestTs).toISOString() : new Date().toISOString(), sightings: [...best.values()] };
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
