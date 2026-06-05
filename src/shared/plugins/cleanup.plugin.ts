import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { env } from '../../config/env';

// ── Advisory lock ──────────────────────────────────────────────────────────────
//
// pg_try_advisory_xact_lock(key) is a transaction-scoped advisory lock built
// into PostgreSQL.  It guarantees that only one database session holds the lock
// at a time and releases it automatically when the transaction ends — no manual
// UNLOCK needed, no risk of a process dying while holding the lock.
//
// The key is derived via hashtext() so the constant is human-readable in code
// and stable across restarts.  hashtext returns int4; casting to bigint avoids
// ambiguity with the bigint overload.
const ADVISORY_LOCK_SQL = `
  SELECT pg_try_advisory_xact_lock(hashtext('playnet_token_cleanup')::bigint) AS acquired
`;

// ── Cleanup function ──────────────────────────────────────────────────────────
//
// Exported so tests can invoke it directly without waiting for the interval.
//
// Returns:
//   { deleted: number, skipped: true }  — another instance held the lock
//   { deleted: number, skipped: false } — this instance ran the cleanup
export async function runExpiredTokenCleanup(
  pg: FastifyInstance['pg'],
  batchSize: number
): Promise<{ deleted: number; skipped: boolean }> {
  const client = await pg.connect();
  try {
    await client.query('BEGIN');

    // Try to acquire the advisory lock — returns immediately with false if
    // another instance (or a concurrent call) already holds it.
    const { rows } = await client.query<{ acquired: boolean }>(ADVISORY_LOCK_SQL);

    if (!rows[0].acquired) {
      await client.query('ROLLBACK');
      return { deleted: 0, skipped: true };
    }

    // Delete at most `batchSize` expired rows in a single statement.
    //
    // Using a subquery + IN keeps the outer DELETE lean: the inner SELECT uses
    // the idx_refresh_tokens_user_id index and the partial scan on expires_at,
    // while the outer DELETE avoids a full sequential scan.
    //
    // LIMIT caps transaction duration and prevents lock contention on tables
    // with large backlogs.  If deleted === batchSize there are likely more rows;
    // the next scheduled run will continue the cleanup.
    const result = await client.query<never>(
      `DELETE FROM refresh_tokens
       WHERE id IN (
         SELECT id FROM refresh_tokens
         WHERE expires_at <= NOW()
         LIMIT $1
       )`,
      [batchSize]
    );

    await client.query('COMMIT');
    return { deleted: result.rowCount ?? 0, skipped: false };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export const cleanupPlugin = fp(
  async (app: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> => {
    const { TOKEN_CLEANUP_INTERVAL_MS, TOKEN_CLEANUP_BATCH_SIZE } = env;

    async function tick(): Promise<void> {
      try {
        const { deleted, skipped } = await runExpiredTokenCleanup(app.pg, TOKEN_CLEANUP_BATCH_SIZE);

        if (skipped) {
          app.log.debug({ event: 'cleanup.tokens.skipped' }, 'cleanup skipped — another instance holds the lock');
          return;
        }

        if (deleted > 0) {
          app.log.info({ event: 'cleanup.tokens.ok', deleted }, 'expired refresh tokens removed');
        } else {
          app.log.debug({ event: 'cleanup.tokens.ok', deleted: 0 }, 'cleanup ran — no expired tokens found');
        }
      } catch (err) {
        // Never let a cleanup failure crash the process or surface to callers.
        // The error is logged; the next scheduled run will retry.
        app.log.error({ err, event: 'cleanup.tokens.error' }, 'expired token cleanup failed');
      }
    }

    // Schedule periodic runs.
    // timer.unref() ensures the interval does not prevent a clean process exit
    // when tests or scripts call app.close() — the OS discards a pending timer
    // that has been unref'd when no other work remains.
    const timer = setInterval(() => void tick(), TOKEN_CLEANUP_INTERVAL_MS);
    timer.unref();

    app.addHook('onClose', async () => {
      clearInterval(timer);
    });

    app.log.info(
      { intervalMs: TOKEN_CLEANUP_INTERVAL_MS, batchSize: TOKEN_CLEANUP_BATCH_SIZE },
      'token cleanup job scheduled'
    );
  }
);
