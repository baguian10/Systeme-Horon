// One-shot Supabase seed for Systeme-Horon live TR40 test.
// Uses the secret (service-role) key — bypasses RLS.
// Run after applying supabase/setup.sql in the SQL Editor:
//   set -a; . ./.env.local; set +a; node scripts/setup-supabase.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const LOGIN_EMAIL = 'magistrat@horon.bf';
const LOGIN_PASSWORD = 'Horon2026!';
const IMEI = process.env.TRAXBEAN_DEMO_IMEI ?? '355932600157247';

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1) Auth user
  let authId;
  {
    const { data, error } = await sb.auth.admin.createUser({
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
      email_confirm: true,
    });
    if (error && !/already|registered|exists/i.test(error.message)) throw error;
    if (data?.user) authId = data.user.id;
    if (!authId) {
      // already exists — find by listing
      const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find((u) => u.email === LOGIN_EMAIL);
      if (!found) throw new Error('auth user exists but not found in list');
      authId = found.id;
    }
  }
  console.log('auth user:', authId);

  // 2) users row (JUDGE)
  const judgeId = await upsert(
    'users',
    { auth_id: authId },
    { auth_id: authId, role: 'JUDGE', full_name: 'Magistrat Horon', jurisdiction: 'Ouagadougou' }
  );
  console.log('judge user row:', judgeId);

  // 3) individual
  const individualId = await upsert(
    'individuals',
    { national_id: 'BFA-1988-4421' },
    { national_id: 'BFA-1988-4421', full_name: 'DONALD Ouedraogo', date_of_birth: '1988-06-14', address: 'Ouagadougou, Burkina Faso' }
  );
  console.log('individual:', individualId);

  // 4) case
  const caseId = await upsert(
    'cases',
    { case_number: 'OUAG-2024-0041' },
    {
      case_number: 'OUAG-2024-0041',
      individual_id: individualId,
      judge_id: judgeId,
      status: 'ACTIVE',
      court_order_date: '2024-03-01',
      start_date: new Date().toISOString(),
      notes: 'Bracelet TR40 — test intégration Traxbean.',
    }
  );
  console.log('case:', caseId);

  // 5) device (real IMEI), assigned to the case
  const deviceId = await upsert(
    'devices',
    { imei: IMEI },
    {
      imei: IMEI,
      case_id: caseId,
      model: 'Traxbean TR40',
      firmware_ver: '1.0',
      battery_pct: 64,
      is_online: true,
      assigned_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    }
  );
  console.log('device:', deviceId);

  console.log('\n✅ Seed done.');
  console.log('Login:', LOGIN_EMAIL, '/', LOGIN_PASSWORD, '(role JUDGE)');
}

// select by `match`; insert `values` if absent; always return id.
async function upsert(table, match, values) {
  const { data: existing } = await sb.from(table).select('id').match(match).maybeSingle();
  if (existing?.id) {
    await sb.from(table).update(values).eq('id', existing.id);
    return existing.id;
  }
  const { data, error } = await sb.from(table).insert(values).select('id').single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.id;
}

main().catch((e) => {
  console.error('SETUP FAILED:', e.message);
  process.exit(1);
});
