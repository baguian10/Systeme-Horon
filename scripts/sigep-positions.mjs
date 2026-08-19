// Où sont les 25 000 positions, et pourquoi la carte n'en montre aucune ?
//   node scripts/sigep-positions.mjs [IMEI]

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const IMEI = process.argv[2] ?? env.TRAXBEAN_DEMO_IMEI;
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const line = (s) => console.log(s);
const ago = (iso) => (iso ? `${Math.round((Date.now() - Date.parse(iso)) / 60000)} min` : '—');

const { data: dev } = await sb.from('devices').select('id, case_id').eq('imei', IMEI).maybeSingle();
line(`\ndevice_id ${dev.id} · case_id ${dev.case_id}`);

const q = async (label, builder) => {
  const { data, error, count } = await builder;
  line(`${label} : ${error ? `ERREUR ${error.message}` : `${count ?? data?.length ?? 0}`}`);
  return data;
};

await q('positions (total)', sb.from('positions').select('*', { count: 'exact', head: true }));
await q('positions de ce bracelet', sb.from('positions').select('*', { count: 'exact', head: true }).eq('device_id', dev.id));
await q('positions de ce dossier', sb.from('positions').select('*', { count: 'exact', head: true }).eq('case_id', dev.case_id));

const { data: last } = await sb.from('positions')
  .select('device_id, case_id, latitude, longitude, recorded_at')
  .order('recorded_at', { ascending: false }).limit(5);
line('\n5 positions les plus récentes, toutes sources confondues :');
for (const p of last ?? []) {
  line(`   ${p.recorded_at} (il y a ${ago(p.recorded_at)}) · ${p.latitude}, ${p.longitude} · device ${p.device_id?.slice(0, 8)} · case ${p.case_id?.slice(0, 8)}`);
}

const { data: cases } = await sb.from('cases').select('id, case_number, status').limit(10);
line('\nDossiers :');
for (const c of cases ?? []) line(`   ${c.id.slice(0, 8)} · ${c.case_number} · ${c.status}${c.id === dev.case_id ? '  ← celui du bracelet' : ''}`);
line('');
