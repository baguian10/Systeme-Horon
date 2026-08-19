// Diagnostic Traxbean hors Next.js : authentification, position temps réel,
// journal du bracelet, et sondage optionnel des commandes de volume.
//
//   node scripts/traxbean-diag.mjs [IMEI]            → diagnostic
//   node scripts/traxbean-diag.mjs [IMEI] --volume 9 → + sonde de volume
//
// Reproduit exactement lib/traxbean/client.ts (même dispatcher TLS relâché,
// même endpoint), sans Supabase : le cache DB du jeton n'entre pas en jeu.

import { readFileSync } from 'node:fs';
import { request, Agent } from 'undici';

// ── .env.local ───────────────────────────────────────────────────────────────
const env = {};
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const API_BASE = env.TRAXBEAN_API_BASE ?? 'https://napi.5gcity.com';
const IMEI = process.argv[2] ?? env.TRAXBEAN_DEMO_IMEI;
const volIdx = process.argv.indexOf('--volume');
const VOLUME = volIdx > -1 ? Number(process.argv[volIdx + 1] ?? 9) : null;

// napi.5gcity.com sert une chaîne de certificats incomplète.
const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });

let token = null;

async function call(path, body, { auth = true } = {}) {
  const res = await request(`${API_BASE}${path}`, {
    method: 'POST', dispatcher,
    headers: { 'Content-Type': 'application/json', ...(auth && token ? { Authorization: token } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.body.json().catch(() => null);
  return { status: res.statusCode, json };
}

const line = (s) => console.log(s);
const short = (v) => JSON.stringify(v)?.slice(0, 400);

// ── 1. Authentification ──────────────────────────────────────────────────────
line(`\n=== Traxbean ${API_BASE} · IMEI ${IMEI} ===\n`);
line(`1. Connexion (${env.TRAXBEAN_USERNAME ?? 'pas de compte'})`);
if (env.TRAXBEAN_USERNAME && env.TRAXBEAN_PASSWORD) {
  const { status, json } = await call('/admin/login',
    { username: env.TRAXBEAN_USERNAME, password: env.TRAXBEAN_PASSWORD }, { auth: false });
  token = json?.data?.token ?? null;
  line(`   HTTP ${status} · code ${json?.code} · ${json?.message ?? ''}`);
  line(token ? `   jeton frais obtenu (${token.length} car.)` : `   ÉCHEC — réponse : ${short(json)}`);
}
if (!token && env.TRAXBEAN_TOKEN) {
  token = env.TRAXBEAN_TOKEN;
  line('   repli sur TRAXBEAN_TOKEN (jeton statique du .env.local)');
}
if (!token) { line('   aucun jeton — arrêt.'); process.exit(1); }

// ── 2. Position temps réel ───────────────────────────────────────────────────
line('\n2. Position (business/location/getDeviceLocationLK)');
{
  const { status, json } = await call('/admin/business/location/getDeviceLocationLK', { imei: IMEI });
  line(`   HTTP ${status} · code ${json?.code} · ${json?.message ?? ''}`);
  const d = json?.data;
  if (d && typeof d.lat === 'number') {
    const age = d.utcTimestamp ? Math.round((Date.now() - Number(d.utcTimestamp)) / 60000) : null;
    line(`   lat ${d.lat} lng ${d.lng} · batterie ${d.battery ?? '?'}% · type ${d.locationType ?? '?'}`);
    line(`   horodatage ${d.utcTimestamp ? new Date(Number(d.utcTimestamp)).toISOString() : '?'}${age !== null ? ` (il y a ${age} min)` : ''}`);
    line(`   adresse : ${d.address || '—'}`);
  } else {
    line(`   PAS DE POSITION — data = ${short(d)}`);
  }
}

// ── 3. Fiche plateforme du bracelet ──────────────────────────────────────────
line('\n3. Inventaire (business/target/page)');
let targetId = null;
for (const departmentId of [0, Number(env.TRAXBEAN_DEPARTMENT_ID ?? 914)]) {
  const { status, json } = await call('/admin/business/target/page', { departmentId });
  const list = json?.data?.list ?? [];
  line(`   dept ${departmentId} → HTTP ${status} · code ${json?.code} · ${list.length} bracelet(s)`);
  const hit = list.find((x) => x.imei === IMEI);
  if (hit && !targetId) {
    targetId = hit.id;
    line(`   trouvé : targetId ${hit.id} · en ligne ${hit.online ?? '?'} · port ${hit.wear ?? '?'} · vu ${hit.lastTime ?? hit.updateTime ?? '?'}`);
  }
  if (list.length && !hit) line(`   IMEI absent de ce périmètre — présents : ${list.slice(0, 5).map((x) => x.imei).join(', ')}`);
}
if (!targetId) line('   ATTENTION : targetId introuvable → toutes les commandes échoueront.');

// ── 4. Journal du terminal ───────────────────────────────────────────────────
line('\n4. Journal (business/device/fetchDeviceLog, 60 dernières minutes)');
{
  const { status, json } = await call('/admin/business/device/fetchDeviceLog',
    { imei: IMEI, startTime: new Date(Date.now() - 60 * 60000).toISOString() });
  const lines = Array.isArray(json?.data) ? json.data : [];
  line(`   HTTP ${status} · code ${json?.code} · ${lines.length} ligne(s)`);
  for (const l of lines.slice(-8)) line(`   ${String(l).slice(0, 150)}`);
  if (!lines.length) line('   journal vide → le bracelet n\'a rien émis depuis 1 h (hors ligne ou en veille).');
}

// ── 5. Sonde de volume (optionnelle) ─────────────────────────────────────────
if (VOLUME !== null) {
  line(`\n5. Sonde de volume niveau ${VOLUME} (BPSM)`);
  if (!targetId) { line('   impossible sans targetId.'); process.exit(0); }
  const forms = ['@volume@=%L@', '@vol@=%L@', '@setvolume@=%L@', '@callvolume@=%L@', '@speaker@=%L@', '@VOLUME=%L@'];
  const startTime = new Date(Date.now() - 60000).toISOString();
  const base = Date.now();
  const probes = [];
  for (let i = 0; i < forms.length; i++) {
    const command = forms[i].replace('%L', String(VOLUME));
    const serial = String(base + i).slice(-6);
    const { json } = await call('/admin/business/target/sendCommand',
      { targetId, imei: IMEI, command: `IWBPSM,${IMEI},${serial},${command}#` });
    const sent = json?.code === 200;
    probes.push({ command, serial, sent });
    line(`   → ${command.padEnd(20)} série ${serial} · ${sent ? 'transmise' : `refusée (${json?.message ?? '?'})`}`);
  }
  line('   attente de la réponse du bracelet (15 s)…');
  await new Promise((r) => setTimeout(r, 15000));
  const { json } = await call('/admin/business/device/fetchDeviceLog', { imei: IMEI, startTime });
  const logs = Array.isArray(json?.data) ? json.data : [];
  line(`   ${logs.length} ligne(s) de journal depuis l'envoi`);
  let answered = 0;
  for (const p of probes) {
    const hit = logs.find((l) => String(l).includes('APSM') && String(l).includes(p.serial));
    if (hit) { answered++; line(`   ✔ ${p.command} → ${String(hit).trim()}`); }
  }
  for (const l of logs.filter((x) => String(x).includes('APSM'))) line(`   [APSM] ${String(l).slice(0, 150)}`);
  line(answered ? `\n   ${answered} commande(s) reconnue(s) par le firmware.`
                : '\n   Aucune réponse : le firmware ne connaît aucune de ces orthographes (ou le bracelet est hors ligne).');
}

line('');
