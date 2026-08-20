// Envoi d'une commande brute au bracelet, puis lecture de ce qui en revient.
//
//   node scripts/traxbean-send.mjs <IMEI> "<commande>" [secondes d'attente]
//
// La commande est passée telle quelle au relais de la plateforme. Deux formes
// existent et ne se comportent PAS pareil : une trame IW complète
// (`IWBP40,<imei>,<série>,…#`) part immédiatement (`--now--`), tandis qu'un
// raccourci nu (`>*wearconfig@1*<`) est mis en file (`--queue--`) et peut ne
// jamais arriver. C'est ce script qui a permis de le voir.

import { readFileSync } from 'node:fs';
import { request, Agent } from 'undici';

const env = {};
for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const API_BASE = env.TRAXBEAN_API_BASE ?? 'https://napi.5gcity.com';
const IMEI = process.argv[2];
const COMMAND = process.argv[3];
const WAIT = Number(process.argv[4] ?? 30);
if (!IMEI || !COMMAND) { console.log('Usage: node scripts/traxbean-send.mjs <IMEI> "<commande>" [secondes]'); process.exit(1); }

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
const page = await call('/admin/business/target/page', { departmentId: 0 }, token);
const targetId = (page?.data?.list ?? []).find((x) => x.imei === IMEI)?.id;
if (!targetId) { console.log('bracelet introuvable'); process.exit(1); }

const logs = async (min) => {
  const j = await call('/admin/business/device/fetchDeviceLog',
    { imei: IMEI, startTime: new Date(Date.now() - min * 60000).toISOString() }, token);
  return Array.isArray(j?.data) ? j.data.map(String) : [];
};

const before = new Set(await logs(20));
const r = await call('/admin/business/target/sendCommand', { targetId, imei: IMEI, command: COMMAND }, token);
console.log(`\nEnvoi : ${COMMAND}`);
console.log(`Plateforme : ${r?.code === 200 ? 'acceptée' : `refusée — ${r?.message}`}`);
console.log(`Attente ${WAIT} s…`);
await new Promise((res) => setTimeout(res, WAIT * 1000));

const fresh = (await logs(20)).filter((l) => !before.has(l));
console.log(`\n${fresh.length} ligne(s) nouvelle(s) :`);
for (const l of fresh.slice(-25)) console.log(`   ${l.slice(0, 200)}`);
console.log('');
