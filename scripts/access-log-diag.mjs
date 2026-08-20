// Journal des consultations : la table est-elle en place, et que contient-elle ?
//   node scripts/access-log-diag.mjs

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data, error, count } = await sb
  .from('case_access_log')
  .select('id, actor_name, actor_role, context, viewed_at, ip_address, case_id', { count: 'exact' })
  .order('viewed_at', { ascending: false })
  .limit(10);

if (error) { console.log(`\ncase_access_log : ABSENTE — ${error.message}\n`); process.exit(1); }

console.log(`\ncase_access_log : présente · ${count} ligne(s)\n`);
for (const r of data) {
  console.log(`   ${r.viewed_at} · ${r.actor_name ?? 'compte supprimé'} (${r.actor_role ?? '?'}) · ${r.context} · dossier ${r.case_id.slice(0, 8)} · ${r.ip_address ?? 'sans adresse'}`);
}
if (!data.length) console.log('   (aucune consultation enregistrée pour le moment)');
console.log('');
