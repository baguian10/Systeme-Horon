// Lecture brute du journal du bracelet, filtrée.
//   node scripts/traxbean-log.mjs [IMEI] [motif] [minutes]

import { readFileSync } from 'node:fs';
import { request, Agent } from 'undici';

const env = {};
for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const API_BASE = env.TRAXBEAN_API_BASE ?? 'https://napi.5gcity.com';
const IMEI = process.argv[2] ?? env.TRAXBEAN_DEMO_IMEI;
const PATTERN = process.argv[3] ?? '';
const MINUTES = Number(process.argv[4] ?? 20);
const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });

const call = async (path, body, auth) => {
  const res = await request(`${API_BASE}${path}`, {
    method: 'POST', dispatcher,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify(body),
  });
  return res.body.json().catch(() => null);
};

const login = await call('/admin/login', { username: env.TRAXBEAN_USERNAME, password: env.TRAXBEAN_PASSWORD });
const token = login?.data?.token ?? env.TRAXBEAN_TOKEN;

const json = await call('/admin/business/device/fetchDeviceLog',
  { imei: IMEI, startTime: new Date(Date.now() - MINUTES * 60000).toISOString() }, token);
const lines = Array.isArray(json?.data) ? json.data : [];
const hits = PATTERN ? lines.filter((l) => String(l).toUpperCase().includes(PATTERN.toUpperCase())) : lines;
console.log(`\n${lines.length} ligne(s) sur ${MINUTES} min · ${hits.length} correspondance(s) pour « ${PATTERN} »\n`);
for (const l of hits.slice(-40)) console.log(`   ${String(l).slice(0, 200)}`);
console.log('');
