// Répartition des positions dans le temps : la collecte a-t-elle continué à
// insérer la même position figée, ou s'est-elle arrêtée ?
//   node scripts/sigep-positions-hist.mjs [IMEI]

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const line = (s) => console.log(s);

const count = async (label, from, to) => {
  let q = sb.from('positions').select('*', { count: 'exact', head: true });
  if (from) q = q.gte('recorded_at', from);
  if (to) q = q.lt('recorded_at', to);
  const { count: n, error } = await q;
  line(`   ${label.padEnd(28)} ${error ? `ERREUR ${error.message}` : n}`);
};

line('\nPositions par tranche (recorded_at) :');
await count('avant 2026-07-01', null, '2026-07-01');
await count('juillet 1–18', '2026-07-01', '2026-07-18');
await count('18 juil. 16:35 pile', '2026-07-18T16:35:39.000Z', '2026-07-18T16:35:40.000Z');
await count('19 juil. → 31 juil.', '2026-07-19', '2026-08-01');
await count('août', '2026-08-01', null);

// La position la plus ancienne et la plus récente
const { data: oldest } = await sb.from('positions').select('recorded_at').order('recorded_at', { ascending: true }).limit(1).maybeSingle();
const { data: newest } = await sb.from('positions').select('recorded_at').order('recorded_at', { ascending: false }).limit(1).maybeSingle();
line(`\n   plus ancienne : ${oldest?.recorded_at}`);
line(`   plus récente  : ${newest?.recorded_at}`);

// Le journal des événements bracelet donne la trace des passages du collecteur.
const { data: evts } = await sb.from('device_events').select('event_type, detail, created_at').order('created_at', { ascending: false }).limit(8);
line('\n8 derniers événements bracelet :');
for (const e of evts ?? []) line(`   ${e.created_at} · ${e.event_type} · ${e.detail ?? ''}`);

// Télémétrie : écrite par le collecteur à chaque changement de batterie.
const { data: tel } = await sb.from('device_telemetry').select('battery_pct, signal_dbm, recorded_at, created_at').order('created_at', { ascending: false }).limit(5);
line('\n5 derniers relevés de télémétrie :');
for (const t of tel ?? []) line(`   ${t.created_at ?? t.recorded_at} · batt ${t.battery_pct}% · signal ${t.signal_dbm}`);
line('');
