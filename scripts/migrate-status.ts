import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { env } from '../src/config/env';

const MIGRATIONS_DIR = join(__dirname, '..', 'database', 'migrations');

async function status(): Promise<void> {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const tableExists = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'schema_migrations'
      ) AS exists
    `);

    if (!tableExists.rows[0].exists) {
      console.log('No migrations have been run yet.');
      return;
    }

    const { rows } = await client.query<{ filename: string; applied_at: Date }>(
      'SELECT filename, applied_at FROM schema_migrations ORDER BY filename'
    );
    const applied = new Map(rows.map((r) => [r.filename, r.applied_at]));

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log('\nMigration status:\n');
    for (const file of files) {
      const date = applied.get(file);
      const status = date ? `✓  applied   ${date.toISOString()}` : '✗  pending';
      console.log(`  ${status}  ${file}`);
    }
    console.log();
  } finally {
    client.release();
    await pool.end();
  }
}

status().catch((err: unknown) => {
  console.error('Status check failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
