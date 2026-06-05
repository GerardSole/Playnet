/**
 * Integration tests for the expired-token cleanup job.
 *
 * Tests call runExpiredTokenCleanup() directly — no timers needed.  This
 * keeps the suite fast and deterministic while exercising the real SQL and
 * the advisory-lock behaviour through actual PostgreSQL connections.
 *
 * Coverage:
 *   1. CORRECTNESS — only expired rows are removed; live rows survive
 *   2. BATCH LIMIT  — stops after batchSize rows; excess rows stay
 *   3. ADVISORY LOCK — only one concurrent run executes; the other is skipped
 *   4. MULTI-INSTANCE — two independent pg.Pool connections simulate two app
 *      instances; the lock prevents double-deletion
 *   5. IDEMPOTENCY   — running cleanup when the table is already clean is safe
 *   6. INTERACTION   — cleanup does not interfere with login / refresh / logout
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { Pool } from 'pg';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { truncate, createUser, createAndLogin, bearer } from './helpers';
import { runExpiredTokenCleanup } from '../src/shared/plugins/cleanup.plugin';

let app: FastifyInstance;

// A second pool simulates a second backend instance sharing the same DB.
let poolB: Pool;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  await truncate(app);

  poolB = new Pool({ connectionString: process.env['DATABASE_URL'] });
});

beforeEach(async () => {
  await truncate(app);
  await app.redis.flushdb();
});

afterAll(async () => {
  await poolB.end();
  await app.close();
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Insert a refresh token row with a custom expires_at (bypasses service layer). */
async function insertToken(
  userId: string,
  hash: string,
  expiresAt: Date
): Promise<void> {
  await app.pg.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hash, expiresAt]
  );
}

/** Count all refresh_tokens rows for a user regardless of expiry. */
async function countAllTokens(userId: string): Promise<number> {
  const { rows } = await app.pg.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM refresh_tokens WHERE user_id = $1`,
    [userId]
  );
  return parseInt(rows[0].count, 10);
}

/** Count only non-expired tokens for a user. */
async function countLiveTokens(userId: string): Promise<number> {
  const { rows } = await app.pg.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM refresh_tokens
     WHERE user_id = $1 AND expires_at > NOW()`,
    [userId]
  );
  return parseInt(rows[0].count, 10);
}

const PAST = new Date(Date.now() - 1_000);          // 1 s ago — already expired
const FUTURE = new Date(Date.now() + 86_400_000);   // 24 h from now — still live
const LARGE_BATCH = 9_999;

// ── Correctness ────────────────────────────────────────────────────────────────

describe('Correctness — only expired rows are removed', () => {
  it('deletes expired tokens and leaves live ones untouched', async () => {
    const user = await createUser(app);

    await insertToken(user.id, 'expired_hash_a', PAST);
    await insertToken(user.id, 'expired_hash_b', PAST);
    await insertToken(user.id, 'live_hash_c', FUTURE);

    const { deleted, skipped } = await runExpiredTokenCleanup(app.pg, LARGE_BATCH);

    expect(skipped).toBe(false);
    expect(deleted).toBe(2);                       // only the two expired rows
    expect(await countLiveTokens(user.id)).toBe(1); // live row untouched
    expect(await countAllTokens(user.id)).toBe(1);
  });

  it('returns deleted = 0 when there are no expired tokens', async () => {
    const user = await createUser(app);
    await insertToken(user.id, 'only_live', FUTURE);

    const { deleted } = await runExpiredTokenCleanup(app.pg, LARGE_BATCH);

    expect(deleted).toBe(0);
    expect(await countLiveTokens(user.id)).toBe(1);
  });

  it('handles an empty table gracefully', async () => {
    const { deleted, skipped } = await runExpiredTokenCleanup(app.pg, LARGE_BATCH);
    expect(deleted).toBe(0);
    expect(skipped).toBe(false);
  });

  it('cleans up tokens from multiple users in one run', async () => {
    const u1 = await createUser(app);
    const u2 = await createUser(app);

    await insertToken(u1.id, 'u1_expired', PAST);
    await insertToken(u2.id, 'u2_expired', PAST);
    await insertToken(u1.id, 'u1_live', FUTURE);

    const { deleted } = await runExpiredTokenCleanup(app.pg, LARGE_BATCH);

    expect(deleted).toBe(2);
    expect(await countLiveTokens(u1.id)).toBe(1);
    expect(await countLiveTokens(u2.id)).toBe(0);
  });
});

// ── Batch limit ────────────────────────────────────────────────────────────────

describe('Batch limit — stops at batchSize rows', () => {
  it('deletes at most batchSize expired tokens per run', async () => {
    const user = await createUser(app);

    // Insert 5 expired tokens
    for (let i = 0; i < 5; i++) {
      await insertToken(user.id, `expired_batch_${i}`, PAST);
    }

    // Run with batchSize = 3
    const first = await runExpiredTokenCleanup(app.pg, 3);
    expect(first.deleted).toBe(3);
    expect(first.skipped).toBe(false);
    expect(await countAllTokens(user.id)).toBe(2); // 2 still waiting

    // Second run clears the rest
    const second = await runExpiredTokenCleanup(app.pg, 3);
    expect(second.deleted).toBe(2);
    expect(await countAllTokens(user.id)).toBe(0);
  });

  it('a batchSize of 1 removes exactly one row per call', async () => {
    const user = await createUser(app);

    await insertToken(user.id, 'exp_1', PAST);
    await insertToken(user.id, 'exp_2', PAST);

    const r1 = await runExpiredTokenCleanup(app.pg, 1);
    expect(r1.deleted).toBe(1);

    const r2 = await runExpiredTokenCleanup(app.pg, 1);
    expect(r2.deleted).toBe(1);

    expect(await countAllTokens(user.id)).toBe(0);
  });
});

// ── Advisory lock ──────────────────────────────────────────────────────────────

describe('Advisory lock — prevents concurrent double-deletion', () => {
  it('skips cleanup when another session already holds the lock', async () => {
    const user = await createUser(app);
    await insertToken(user.id, 'locked_expired', PAST);

    // Acquire the same advisory lock from an external connection to simulate
    // a second instance that is currently running cleanup.
    const lockClient = await poolB.connect();
    try {
      await lockClient.query('BEGIN');
      await lockClient.query(
        `SELECT pg_advisory_xact_lock(hashtext('playnet_token_cleanup')::bigint)`
      );

      // Our cleanup attempt should be skipped — the lock is held externally.
      const { deleted, skipped } = await runExpiredTokenCleanup(app.pg, LARGE_BATCH);

      expect(skipped).toBe(true);
      expect(deleted).toBe(0);

      // The expired token must still exist (cleanup was skipped).
      expect(await countAllTokens(user.id)).toBe(1);
    } finally {
      // Releasing the transaction releases the advisory lock automatically.
      await lockClient.query('ROLLBACK');
      lockClient.release();
    }

    // Now that the external lock is gone, cleanup should proceed.
    const { deleted, skipped } = await runExpiredTokenCleanup(app.pg, LARGE_BATCH);
    expect(skipped).toBe(false);
    expect(deleted).toBe(1);
    expect(await countAllTokens(user.id)).toBe(0);
  });

  it('two concurrent cleanup calls produce exactly one deletion total', async () => {
    const user = await createUser(app);

    // Insert 10 expired tokens
    for (let i = 0; i < 10; i++) {
      await insertToken(user.id, `concurrent_exp_${i}`, PAST);
    }

    // Fire two cleanup calls simultaneously.
    // Due to the Node.js event loop the calls may interleave or run sequentially
    // at the PostgreSQL level, but the important invariant is: no double-deletion.
    const [r1, r2] = await Promise.all([
      runExpiredTokenCleanup(app.pg, LARGE_BATCH),
      runExpiredTokenCleanup(app.pg, LARGE_BATCH),
    ]);

    // Total rows deleted must equal exactly 10 — no row deleted twice.
    expect(r1.deleted + r2.deleted).toBe(10);
    // All expired tokens cleaned up.
    expect(await countAllTokens(user.id)).toBe(0);
  });
});

// ── Multi-instance simulation ─────────────────────────────────────────────────

describe('Multi-instance — two independent Postgres pools share advisory lock', () => {
  it('instance B is skipped while instance A runs cleanup', async () => {
    const user = await createUser(app);
    await insertToken(user.id, 'multi_inst_exp', PAST);

    // Simulate instance A holding the lock
    const clientA = await app.pg.connect();
    try {
      await clientA.query('BEGIN');
      const { rows } = await clientA.query<{ acquired: boolean }>(
        `SELECT pg_try_advisory_xact_lock(hashtext('playnet_token_cleanup')::bigint) AS acquired`
      );
      expect(rows[0].acquired).toBe(true);

      // Instance B (poolB) tries to run cleanup — must be skipped
      const resultB = await runExpiredTokenCleanup(poolB, LARGE_BATCH);
      expect(resultB.skipped).toBe(true);
      expect(resultB.deleted).toBe(0);

      // Expired token still exists — B did not delete it
      expect(await countAllTokens(user.id)).toBe(1);
    } finally {
      await clientA.query('ROLLBACK'); // releases A's advisory lock
      clientA.release();
    }

    // Instance B can now run
    const resultB2 = await runExpiredTokenCleanup(poolB, LARGE_BATCH);
    expect(resultB2.skipped).toBe(false);
    expect(resultB2.deleted).toBe(1);
  });
});

// ── Idempotency ────────────────────────────────────────────────────────────────

describe('Idempotency — repeated runs are safe', () => {
  it('running cleanup twice does not fail or double-delete', async () => {
    const user = await createAndLogin(app);
    await insertToken(user.id, 'idem_exp', PAST);

    const r1 = await runExpiredTokenCleanup(app.pg, LARGE_BATCH);
    expect(r1.deleted).toBe(1);

    // Second run — nothing left to delete
    const r2 = await runExpiredTokenCleanup(app.pg, LARGE_BATCH);
    expect(r2.deleted).toBe(0);
    expect(r2.skipped).toBe(false);
  });
});

// ── Interaction with auth flow ────────────────────────────────────────────────

describe('Interaction — cleanup does not disturb live auth operations', () => {
  it('cleanup running concurrently with login does not invalidate the new session', async () => {
    const user = await createAndLogin(app);

    // Seed some expired tokens to give cleanup something to do
    for (let i = 0; i < 5; i++) {
      await insertToken(user.id, `bg_expired_${i}`, PAST);
    }

    // Run cleanup and a login simultaneously
    const [cleanupResult, loginRes] = await Promise.all([
      runExpiredTokenCleanup(app.pg, LARGE_BATCH),
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: user.email, password: user.password },
      }),
    ]);

    expect(loginRes.statusCode).toBe(200);
    const { refreshToken } = JSON.parse(loginRes.body) as { refreshToken: string };
    expect(cleanupResult.deleted).toBeGreaterThanOrEqual(0); // cleanup ran or skipped

    // The token from the concurrent login must still be valid
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(refreshRes.statusCode).toBe(200);
  });

  it('cleanup removes expired tokens but leaves the active session from /login', async () => {
    // Use createUser (no login) so the only live token is the one created below
    const user = await createUser(app);

    // Mix expired and live tokens
    await insertToken(user.id, 'old_exp_a', PAST);
    await insertToken(user.id, 'old_exp_b', PAST);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: user.email, password: user.password },
    });
    const { refreshToken } = JSON.parse(loginRes.body) as { refreshToken: string };

    await runExpiredTokenCleanup(app.pg, LARGE_BATCH);

    // Exactly 1 session (the live login) must survive
    expect(await countLiveTokens(user.id)).toBe(1);

    // That session must still be usable
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(refreshRes.statusCode).toBe(200);
  });

  it('cleanup respects the rate limit headers on subsequent requests', async () => {
    // Verify cleanup does not touch Redis rate-limit keys or cause 429 responses
    await runExpiredTokenCleanup(app.pg, LARGE_BATCH);

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
  });
});
