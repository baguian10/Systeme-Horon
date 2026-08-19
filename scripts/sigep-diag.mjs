// Diagnostic côté SIGEP : pourquoi le temps réel n'apparaît pas dans la
// plateforme alors que Traxbean répond. Lecture seule (clé service role).
//
//   node scripts/sigep-diag.mjs [IMEI]

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const IMEI = process.argv[2] ?? env.TRAXBEAN_DEMO_IMEI;
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ago = (iso) => (iso ? `${Math.round((Date.now() - Date.parse(iso)) / 60000)} min` : '—');
const line = (s) => console.log(s);

line(`\n=== SIGEP · base ${env.NEXT_PUBLIC_SUPABASE_URL} · IMEI ${IMEI} ===\n`);

// 1. Le bracelet est-il enregistré, et rattaché à un dossier ?
const { data: devices, error: devErr } = await sb
  .from('devices')
  .select('id, imei, case_id, is_online, sync_status, battery_pct, last_seen_at, last_heartbeat_at, lifecycle_status');
line(`1. Bracelets en base : ${devErr ? `ERREUR ${devErr.message}` : devices.length}`);
for (const d of devices ?? []) {
  const me = d.imei === IMEI ? ' ←' : '';
  line(`   ${d.imei} · dossier ${d.case_id ?? 'AUCUN'} · ${d.is_online ? 'en ligne' : 'hors ligne'} · sync ${d.sync_status ?? '—'} · batt ${d.battery_pct ?? '—'}% · vu il y a ${ago(d.last_seen_at)} · pollé il y a ${ago(d.last_heartbeat_at)}${me}`);
}
const dev = (devices ?? []).find((d) => d.imei === IMEI);
if (!dev) line(`   ⚠ IMEI ${IMEI} ABSENT de la table devices → jamais interrogé par le cron.`);
else if (!dev.case_id) line(`   ⚠ IMEI ${IMEI} sans dossier → le cron l'ignore ("Only poll devices assigned to a case").`);

// 2. Les positions arrivent-elles ?
if (dev) {
  const { data: pos } = await sb
    .from('positions').select('recorded_at, latitude, longitude, created_at')
    .eq('device_id', dev.id).order('recorded_at', { ascending: false }).limit(5);
  line(`\n2. Positions enregistrées pour ce bracelet : ${pos?.length ?? 0} (5 dernières)`);
  for (const p of pos ?? []) line(`   ${p.recorded_at} (il y a ${ago(p.recorded_at)}) · ${p.latitude}, ${p.longitude}`);
  if (!pos?.length) line('   ⚠ aucune position → la chaîne d\'ingestion n\'a jamais tourné pour ce bracelet.');
}

// 3. Santé du lien Traxbean vue par la plateforme
const { data: st } = await sb
  .from('system_settings')
  .select('traxbean_auth_ok, traxbean_auth_checked_at, traxbean_token_at, traxbean_login_fail_at')
  .eq('id', 1).maybeSingle();
line('\n3. Lien Traxbean vu par la plateforme');
if (!st) line('   aucune ligne system_settings id=1.');
else {
  line(`   auth ok : ${st.traxbean_auth_ok} · vérifié il y a ${ago(st.traxbean_auth_checked_at)}`);
  line(`   jeton en cache daté d'il y a ${ago(st.traxbean_token_at)} · dernier échec de login ${st.traxbean_login_fail_at ? `il y a ${ago(st.traxbean_login_fail_at)}` : 'aucun'}`);
  if (st.traxbean_auth_checked_at && Date.now() - Date.parse(st.traxbean_auth_checked_at) > 10 * 60000) {
    line('   ⚠ dernière vérification ancienne → le cron de collecte ne tourne pas.');
  }
}

// 4. Dossiers actifs (un bracelet ne se voit sur la carte qu'via son dossier)
const { data: cases } = await sb.from('cases').select('id, case_number, status, device_id').limit(10);
line(`\n4. Dossiers : ${cases?.length ?? 0}`);
for (const c of cases ?? []) line(`   ${c.case_number} · ${c.status} · bracelet ${c.device_id ?? 'aucun'}`);

line('');
