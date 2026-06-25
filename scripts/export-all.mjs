// Full database export → JSON snapshot (for migration to a local/self-hosted DB).
// Usage (Windows, Bitdefender TLS):
//   PGHOST=... PGUSER=... PGPASSWORD=... node --use-system-ca scripts/export-all.mjs
// Dumps every public table to backups/<timestamp>/<table>.json + a manifest.
import { mkdirSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE ?? 'postgres',
  ssl: { rejectUnauthorized: false },
});

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const dir = `backups/${stamp}`;

try {
  await client.connect();
  mkdirSync(dir, { recursive: true });

  const { rows: tables } = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
  );

  const manifest = { exported_at: new Date().toISOString(), tables: {} };
  for (const { table_name } of tables) {
    const { rows } = await client.query(`SELECT * FROM "${table_name}"`);
    writeFileSync(`${dir}/${table_name}.json`, JSON.stringify(rows, null, 2));
    manifest.tables[table_name] = rows.length;
    console.log(`${table_name}: ${rows.length} rows`);
  }
  writeFileSync(`${dir}/_manifest.json`, JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Export complete → ${dir}`);
  console.log('Note: auth.users (Supabase Auth) is NOT included — migrate accounts separately.');
} catch (e) {
  console.error('EXPORT FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
