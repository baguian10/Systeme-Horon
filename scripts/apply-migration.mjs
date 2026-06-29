// Apply a migration file to Supabase Postgres.
//   PGPASSWORD='...' node --use-system-ca scripts/apply-migration.mjs supabase/migrations/<file>.sql
// Host/user are derived from the project ref in .env.local (override with PGHOST/PGUSER/PGPORT).
// NOTE: runs the whole file as one statement — fine for plain DDL (ALTER TABLE,
// CREATE TABLE). Do NOT use for files containing `ALTER TYPE ... ADD VALUE`
// (those need their own transaction — use a dedicated script).
import { readFileSync } from 'node:fs';
import pg from 'pg';

const file = process.argv[2];
if (!file) { console.error('Usage: node apply-migration.mjs <path.sql>'); process.exit(1); }
const sql = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

let ref = process.env.SUPABASE_PROJECT_REF;
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  const m = /NEXT_PUBLIC_SUPABASE_URL=\s*https?:\/\/([a-z0-9]+)\.supabase\.co/i.exec(env);
  if (m) ref = ref ?? m[1];
} catch {}

const host = process.env.PGHOST ?? 'aws-1-us-east-2.pooler.supabase.com';
const user = process.env.PGUSER ?? (ref ? `postgres.${ref}` : 'postgres');
const port = Number(process.env.PGPORT ?? 5432);
if (!process.env.PGPASSWORD) { console.error('Missing PGPASSWORD'); process.exit(1); }

const client = new pg.Client({ host, port, user, password: process.env.PGPASSWORD, database: process.env.PGDATABASE ?? 'postgres', ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  console.log(`connected → ${user}@${host}:${port}`);
  await client.query(sql);
  console.log(`✅ applied ${file}`);
} catch (e) {
  console.error('APPLY FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
