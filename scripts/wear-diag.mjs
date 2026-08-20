// Détection de port : que sait la plateforme, que dit le bracelet ?
//   node scripts/wear-diag.mjs [IMEI] [--activer]

import { readFileSync } from 'node:fs';
import { request, Agent } from 'undici';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const API_BASE = env.TRAXBEAN_API_BASE ?? 'https://napi.5gcity.com';
const IMEI = process.argv[2] ?? env.TRAXBEAN_DEMO_IMEI;
const ACTIVER = process.argv.includes('--activer');
const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });

const call = async (path, body, auth) => {
  const res = await request(`${API_BASE}${path}`, {
    method: 'POST', dispatcher,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify(body),
  });
  return res.body.json().catch(() => null);
};
const line = (s) => console.log(s);

const login = await call('/admin/login', { username: env.TRAXBEAN_USERNAME, password: env.TRAXBEAN_PASSWORD });
const token = login?.data?.token ?? env.TRAXBEAN_TOKEN;

// 1. Ce que la plateforme Traxbean expose sur la fiche du bracelet.
const page = await call('/admin/business/target/page', { departmentId: 0 }, token);
const target = (page?.data?.list ?? []).find((x) => x.imei === IMEI);
line(`\n1. Fiche Traxbean · targetId ${target?.id}`);
line(`   champ wear = ${target?.wear}  (1 porté · 0 retiré · -1 détection inactive/inconnue)`);

// 2. Ce que le bracelet a effectivement émis (APWR) et son mode de travail.
const logs = await call('/admin/business/device/fetchDeviceLog',
  { imei: IMEI, startTime: new Date(Date.now() - 6 * 3600000).toISOString() }, token);
const lines = Array.isArray(logs?.data) ? logs.data.map(String) : [];
const apwr = lines.filter((l) => l.includes('APWR'));
line(`\n2. Journal sur 6 h : ${lines.length} ligne(s) · ${apwr.length} trame(s) APWR (statut de port)`);
for (const l of apwr.slice(-5)) line(`   ${l.slice(0, 160)}`);
if (!apwr.length) line('   aucune trame APWR → la détection de port n\'est pas activée sur le bracelet.');

// 3. Ce que SIGEP a enregistré.
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: dev } = await sb.from('devices').select('id, worn, worn_checked_at, case_id, is_online').eq('imei', IMEI).maybeSingle();
line(`\n3. Base SIGEP : worn = ${dev?.worn} · vérifié ${dev?.worn_checked_at ?? 'jamais'}`);

// 4. Activation à la demande.
if (ACTIVER) {
  line('\n4. Activation de la détection de port (>*wearconfig@1*<)');
  const r = await call('/admin/business/target/sendCommand',
    { targetId: target.id, imei: IMEI, command: '>*wearconfig@1*<' }, token);
  line(`   ${r?.code === 200 ? 'commande transmise' : `refusée : ${r?.message}`}`);
  line('   attente de 45 s puis relecture du journal…');
  await new Promise((res) => setTimeout(res, 45000));
  const after = await call('/admin/business/device/fetchDeviceLog',
    { imei: IMEI, startTime: new Date(Date.now() - 5 * 60000).toISOString() }, token);
  const l2 = Array.isArray(after?.data) ? after.data.map(String) : [];
  const wr = l2.filter((l) => l.includes('APWR') || l.includes('wearconfig'));
  for (const l of wr.slice(-6)) line(`   ${l.slice(0, 160)}`);
  if (!wr.length) line('   toujours aucune trame APWR.');
  const page2 = await call('/admin/business/target/page', { departmentId: 0 }, token);
  const t2 = (page2?.data?.list ?? []).find((x) => x.imei === IMEI);
  line(`   champ wear après activation = ${t2?.wear}`);
}
line('');
