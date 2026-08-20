// Bascule un réglage booléen d'un bracelet, comme le ferait l'interrupteur de
// la fiche bracelet — utile quand on n'a pas de session ouverte.
//   node scripts/set-device-flag.mjs <IMEI> <colonne> <true|false>

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const [IMEI, COL, VAL] = process.argv.slice(2);
if (!IMEI || !COL || !VAL) { console.log('Usage: node scripts/set-device-flag.mjs <IMEI> <colonne> <true|false>'); process.exit(1); }

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const value = VAL === 'true';

const { data, error } = await sb.from('devices').update({ [COL]: value }).eq('imei', IMEI).select(`id, imei, ${COL}`).maybeSingle();
if (error) { console.log(`\nÉchec : ${error.message}\n`); process.exit(1); }
if (!data) { console.log(`\nAucun bracelet ${IMEI}.\n`); process.exit(1); }
console.log(`\n${data.imei} · ${COL} = ${data[COL]}\n`);
