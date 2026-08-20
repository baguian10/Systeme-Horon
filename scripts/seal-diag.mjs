// Scellé des positions et table d'escorte : en place ? et que valent-ils ?
//   node scripts/seal-diag.mjs [caseId]

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const env = {};
for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const line = (s) => console.log(s);

// 1. Colonnes de scellé
const { data: probe, error: probeErr } = await sb
  .from('positions').select('id, device_id, recorded_at, latitude, longitude, seal_seq, seal_prev, seal_hash')
  .not('seal_hash', 'is', null).order('seal_seq', { ascending: false }).limit(5);
line(`\n1. Colonnes de scellé : ${probeErr ? `ABSENTES — ${probeErr.message}` : 'présentes'}`);

if (!probeErr) {
  const { count: sealed } = await sb.from('positions').select('id', { count: 'exact', head: true }).not('seal_hash', 'is', null);
  const { count: total } = await sb.from('positions').select('id', { count: 'exact', head: true });
  line(`   ${sealed} position(s) scellée(s) sur ${total} — les autres précèdent le dispositif.`);
  for (const p of probe ?? []) {
    line(`   rang ${p.seal_seq} · ${p.recorded_at} · ${String(p.seal_hash).slice(0, 16)}…`);
  }

  // 2. Vérification de la chaîne (même calcul que lib/track/seal.ts)
  const { data: rows } = await sb
    .from('positions').select('device_id, recorded_at, latitude, longitude, seal_seq, seal_prev, seal_hash')
    .not('seal_hash', 'is', null).order('seal_seq', { ascending: true }).limit(5000);
  let prev = null, broken = null, checked = 0;
  for (const r of rows ?? []) {
    checked++;
    if (prev !== null && r.seal_prev !== prev) { broken ??= { seq: r.seal_seq, why: 'chaînon manquant' }; prev = r.seal_hash; continue; }
    const payload = [r.device_id, new Date(r.recorded_at).toISOString(), r.latitude.toFixed(6), r.longitude.toFixed(6), r.seal_prev ?? 'GENESE'].join('|');
    const expected = createHash('sha256').update(payload).digest('hex');
    if (expected !== r.seal_hash) broken ??= { seq: r.seal_seq, why: 'relevé modifié' };
    prev = r.seal_hash;
  }
  line(`\n2. Chaîne : ${checked} relevé(s) vérifié(s) → ${broken ? `ROMPUE au rang ${broken.seq} (${broken.why})` : 'intacte'}`);
}

// 3. Escorte
const { error: agErr, count: agCount } = await sb.from('agent_positions').select('user_id', { count: 'exact', head: true });
line(`\n3. Table d'escorte : ${agErr ? `ABSENTE — ${agErr.message}` : `présente · ${agCount} agent(s) en partage`}`);
line('');
