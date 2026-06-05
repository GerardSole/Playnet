import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { env } from './config/env';

// __dirname = dist/ when compiled.
// database/migrations/ lives one level above dist/, at the project root.
const MIGRATIONS_DIR = join(__dirname, '..', 'database', 'migrations');

const BOOTSTRAP = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )
`;

async function migrate(): Promise<void> {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query(BOOTSTRAP);

    const { rows } = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations ORDER BY filename'
    );
    const applied = new Set(rows.map((r) => r.filename));

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let ran = 0;

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip  ${file}`);
        continue;
      }

      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ✓     ${file}`);
        ran++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log(ran === 0 ? '\nNothing to migrate.' : `\n${ran} migration(s) applied.`);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err: unknown) => {
  console.error('Migration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
