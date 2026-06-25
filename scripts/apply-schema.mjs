// Applies supabase/setup.sql to the database. One-shot.
//   node --use-system-ca scripts/apply-schema.mjs
import { readFileSync } from 'node:fs';
import pg from 'pg';

const sql = readFileSync(new URL('../supabase/setup.sql', import.meta.url), 'utf8');

const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE ?? 'postgres',
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log('connected');
  await client.query(sql);
  console.log('✅ setup.sql applied');
} catch (e) {
  console.error('APPLY FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
