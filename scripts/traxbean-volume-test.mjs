// Sondage sérialisé des commandes de volume.
//
// Deux leçons du premier essai : la plateforme ne relaie qu'UNE commande à la
// fois (cinq des six envois n'ont jamais atteint le bracelet), et il faut un
// témoin de contrôle — une commande dont on sait qu'elle existe — sinon
// « aucune réponse » ne distingue pas « firmware muet » de « méthode fausse ».
//
//   node scripts/traxbean-volume-test.mjs [IMEI] [niveau]

import { readFileSync } from 'node:fs';
import { request, Agent } from 'undici';

const env = {};
for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const API_BASE = env.TRAXBEAN_API_BASE ?? 'https://napi.5gcity.com';
const IMEI = process.argv[2] ?? env.TRAXBEAN_DEMO_IMEI;
const LEVEL = Number(process.argv[3] ?? 9);
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
const targets = await call('/admin/business/target/page', { departmentId: 0 }, token);
const targetId = (targets?.data?.list ?? []).find((x) => x.imei === IMEI)?.id;
if (!targetId) { console.log('bracelet introuvable'); process.exit(1); }

const logLines = async (minutes) => {
  const j = await call('/admin/business/device/fetchDeviceLog',
    { imei: IMEI, startTime: new Date(Date.now() - minutes * 60000).toISOString() }, token);
  return Array.isArray(j?.data) ? j.data.map(String) : [];
};

// Un envoi, puis lecture des lignes apparues depuis — toutes, pas seulement
// APSM : le firmware peut répondre sous une autre étiquette.
async function tryCommand(label, content, waitMs = 20000) {
  const before = new Set(await logLines(30));
  const serial = String(Date.now()).slice(-6);
  const frame = `IWBPSM,${IMEI},${serial},${content}#`;
  const r = await call('/admin/business/target/sendCommand', { targetId, imei: IMEI, command: frame }, token);
  console.log(`\n▶ ${label}\n   envoi ${content}  (série ${serial}) → ${r?.code === 200 ? 'accepté par la plateforme' : `refusé : ${r?.message}`}`);
  await new Promise((res) => setTimeout(res, waitMs));
  const after = await logLines(30);
  const fresh = after.filter((l) => !before.has(l));
  const relayed = fresh.some((l) => l.includes(serial));
  const answers = fresh.filter((l) => /AP(SM|40)/.test(l) || l.includes(serial));
  console.log(`   relayée au bracelet : ${relayed ? 'oui' : 'NON (restée en file)'} · ${fresh.length} ligne(s) nouvelles`);
  for (const a of answers) console.log(`   ↩ ${a.slice(0, 180)}`);
  if (!answers.length) console.log('   ↩ aucune réponse du terminal');
  return { relayed, answered: answers.length > 0 };
}

console.log(`\n=== Sondage volume · bracelet ${IMEI} · niveau ${LEVEL} ===`);

if (!process.argv.includes('--sans-temoin')) {
  console.log('\n— Témoin de contrôle (commande documentée, doit répondre) —');
  const control = await tryCommand('deviceinfo (état du terminal)', '@deviceinfo@');
  if (!control.answered) await tryCommand('deviceinfo, forme SMS', '123456#deviceinfo#');
}

// Série par défaut, ou liste passée en ligne de commande : --formes a,b,c
const formsIdx = process.argv.indexOf('--formes');
const FORMS = formsIdx > -1
  ? process.argv[formsIdx + 1].split(',')
  : ['@volume@=%L@', '@vol@=%L@', '@setvolume@=%L@', '@callvolume@=%L@', '@speaker@=%L@', '@VOLUME=%L@'];

console.log('\n— Candidates volume —');
for (const form of FORMS) {
  await tryCommand(form, form.replace('%L', String(LEVEL)));
}
console.log('');
