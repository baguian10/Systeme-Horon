// État de la sangle, lu depuis les trames d'alarme AP10 du bracelet.
// Vérifie sur des données réelles l'analyse utilisée par lib/traxbean/client.ts.
//   node scripts/strap-diag.mjs [IMEI] [heures]

import { readFileSync } from 'node:fs';
import { request, Agent } from 'undici';

const env = {};
for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const API_BASE = env.TRAXBEAN_API_BASE ?? 'https://napi.5gcity.com';
const IMEI = process.argv[2] ?? env.TRAXBEAN_DEMO_IMEI;
const HOURS = Number(process.argv[3] ?? 12);
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
const j = await call('/admin/business/device/fetchDeviceLog',
  { imei: IMEI, startTime: new Date(Date.now() - HOURS * 3600000).toISOString() }, token);
const lines = (Array.isArray(j?.data) ? j.data : []).map(String);

const LABEL = {
  '00': 'aucune alarme', '01': 'SOS', '02': 'batterie faible',
  '03': 'terminal retiré', '05': 'sangle ouverte ou arrachée', '06': 'chute',
  '14': 'sédentarité', '16': 'sangle verrouillée', '19': 'extinction',
};

const parse = (line) => {
  const head = /IWAP10(\d{6})[AV].*?(\d{6})\d{3}\.\d{2}/.exec(line);
  const fields = line.slice(line.indexOf('IWAP10')).split(',');
  const code = (fields[5] ?? '').trim();
  let at = null;
  if (head) {
    const [, d, t] = head;
    at = `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}Z`;
  }
  return { code, at };
};

const alarms = lines.filter((l) => l.includes('IWAP10')).map(parse);
console.log(`\n${lines.length} ligne(s) sur ${HOURS} h · ${alarms.length} trame(s) d'alarme AP10\n`);
for (const a of alarms) console.log(`   ${a.at ?? '?'}  code ${a.code}  ${LABEL[a.code] ?? 'inconnu'}`);

const last = [...alarms].reverse().find((a) => ['03', '05', '16'].includes(a.code));
console.log(last
  ? `\n→ Dernier état concluant : ${last.code === '16' ? 'SANGLE FERMÉE (porté)' : 'SANGLE OUVERTE (retiré)'} depuis ${last.at}\n`
  : '\n→ Aucune trame concluante sur la fenêtre.\n');
