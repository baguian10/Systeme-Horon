// Applies supabase/migrations/20260629000000_curfew_and_realtime.sql.
// Each statement runs separately because ALTER TYPE ... ADD VALUE cannot run
// inside a transaction block.
//
// Usage (only the DB password is secret — host/user are derived from the
// project ref in .env.local, override with PGHOST/PGUSER/PGPORT if needed):
//   PGPASSWORD='your-db-password' node --use-system-ca scripts/apply-curfew-migration.mjs
import { readFileSync } from 'node:fs';
import pg from 'pg';

// Load NEXT_PUBLIC_SUPABASE_URL from .env.local to derive the project ref.
let ref = process.env.SUPABASE_PROJECT_REF;
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const m = /NEXT_PUBLIC_SUPABASE_URL=\s*https?:\/\/([a-z0-9]+)\.supabase\.co/i.exec(env);
  if (m) ref = ref ?? m[1];
} catch {}

const host = process.env.PGHOST ?? 'aws-1-us-east-2.pooler.supabase.com';
const user = process.env.PGUSER ?? (ref ? `postgres.${ref}` : 'postgres');
const port = Number(process.env.PGPORT ?? 5432);

if (!process.env.PGPASSWORD) {
  console.error('Missing PGPASSWORD (Supabase database password).');
  process.exit(1);
}

const statements = [
  `ALTER TYPE alert_type ADD VALUE IF NOT EXISTS 'CURFEW_VIOLATION'`,
  `ALTER TABLE geofences
     ADD COLUMN IF NOT EXISTS grace_minutes INT NOT NULL DEFAULT 10,
     ADD COLUMN IF NOT EXISTS out_since     TIMESTAMPTZ`,
  `DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE positions; EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE alerts;    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

const client = new pg.Client({
  host, port, user,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE ?? 'postgres',
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log(`connected → ${user}@${host}:${port}`);
  for (const [i, sql] of statements.entries()) {
    await client.query(sql);
    console.log(`✅ [${i + 1}/${statements.length}] ok`);
  }
  console.log('✅ migration applied');
} catch (e) {
  console.error('APPLY FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
