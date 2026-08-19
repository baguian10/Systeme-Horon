// Vérifie qu'une colonne existe et est lisible/écrivable via l'API.
//   node scripts/check-column.mjs [colonne]

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const col = process.argv[2] ?? 'call_whitelist_only';
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data, error } = await sb.from('devices').select(`id, imei, call_whitelist, call_enabled, ${col}`).limit(5);
if (error) { console.log(`\ndevices.${col} : ABSENTE — ${error.message}\n`); process.exit(1); }
console.log(`\ndevices.${col} : présente et lisible`);
for (const d of data) {
  console.log(`   ${d.imei} · ${col} = ${d[col]} · appels ${d.call_enabled} · ${(d.call_whitelist ?? []).length} numéro(s) autorisé(s)`);
}

// Écriture d'essai à la valeur déjà en place : prouve que la colonne accepte
// l'écriture sans rien changer à la configuration du bracelet.
const target = data[0];
if (target) {
  const { error: wErr } = await sb.from('devices').update({ [col]: target[col] }).eq('id', target.id);
  console.log(wErr ? `   écriture : REFUSÉE — ${wErr.message}` : '   écriture : acceptée (valeur inchangée)');
}
console.log('');
