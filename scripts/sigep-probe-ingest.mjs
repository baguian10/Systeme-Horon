// Vérifie pourquoi les positions n'atterrissent pas : le dossier référencé par
// le bracelet existe-t-il, et que répond exactement l'insertion ?
// Lecture + une insertion d'essai annulée aussitôt (supprimée après contrôle).
//
//   node scripts/sigep-probe-ingest.mjs [IMEI]

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

const { data: dev } = await sb.from('devices').select('id, imei, case_id').eq('imei', IMEI).maybeSingle();
line(`\nBracelet ${IMEI} → device_id ${dev?.id} · case_id ${dev?.case_id ?? 'aucun'}`);

const { data: c, error: cErr } = await sb.from('cases').select('id, case_number, status, device_id').eq('id', dev.case_id).maybeSingle();
line(`Dossier référencé : ${c ? `${c.case_number} (${c.status})` : `INTROUVABLE${cErr ? ` — ${cErr.message}` : ''}`}`);

const { count: caseCount } = await sb.from('cases').select('*', { count: 'exact', head: true });
const { count: posCount } = await sb.from('positions').select('*', { count: 'exact', head: true });
const { count: indCount } = await sb.from('individuals').select('*', { count: 'exact', head: true });
line(`Table cases : ${caseCount} ligne(s) · individuals : ${indCount} · positions : ${posCount}`);

// Insertion d'essai : c'est elle qui révèle l'erreur que la route d'ingestion
// ignore silencieusement (elle n'inspecte jamais l'erreur retournée).
const { data: ins, error: insErr } = await sb.from('positions').insert({
  device_id: dev.id, case_id: dev.case_id, latitude: 12.3934, longitude: -1.4414,
  recorded_at: new Date().toISOString(),
}).select('id').maybeSingle();

if (insErr) line(`\nInsertion d'essai REFUSÉE → ${insErr.code} ${insErr.message}`);
else { line(`\nInsertion d'essai acceptée (${ins.id}) — suppression…`); await sb.from('positions').delete().eq('id', ins.id); }

line('');
