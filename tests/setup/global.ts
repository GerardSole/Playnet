/**
 * Vitest global setup — runs ONCE before all test files in a separate process.
 * Responsibilities: create playnet_test database + apply all migrations.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.test'), override: true });

const TEST_DB_URL = process.env['DATABASE_URL']!;
const ADMIN_DB_URL = TEST_DB_URL.replace('/playnet_test', '/postgres');
const MIGRATIONS_DIR = join(process.cwd(), 'database', 'migrations');

export async function setup(): Promise<void> {
  // Create the test database if it doesn't already exist
  const admin = new Pool({ connectionString: ADMIN_DB_URL });
  try {
    await admin.query('CREATE DATABASE playnet_test');
    console.log('[test:setup] Created playnet_test database');
  } catch (err) {
    if ((err as NodeJS.ErrnoException & { code?: string }).code !== '42P04') throw err;
    // 42P04 = database already exists — fine
  } finally {
    await admin.end();
  }

  // Apply pending migrations to the test database
  const pool = new Pool({ connectionString: TEST_DB_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows } = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations'
    );
    const applied = new Set(rows.map((r) => r.filename));
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[test:setup] Migration applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

export async function teardown(): Promise<void> {
  // Keep test database for post-mortem inspection
}
