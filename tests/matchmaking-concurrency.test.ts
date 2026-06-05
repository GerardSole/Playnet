/**
 * Concurrency tests for the matchmaking system.
 *
 * These tests fire multiple requests in parallel (Promise.all) so that async
 * I/O operations — specifically Redis calls — can interleave within the same
 * event loop.  They verify the three core safety invariants:
 *
 *   1. A player can never be added to the queue twice (duplicate-join race).
 *   2. A player can never appear in two different matches (double-match race).
 *   3. Match creation is atomic: N concurrent joins produce floor(N/2) matches,
 *      each with exactly MATCH_SIZE distinct players, and no player is lost.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { createAndLogin, bearer, truncate, type TestUser } from './helpers';

let app: FastifyInstance;

// Six users so we can exercise larger concurrent batches.
let users: TestUser[];

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  await truncate(app);
  await app.redis.flushdb();
  users = await Promise.all(Array.from({ length: 6 }, () => createAndLogin(app)));
});

beforeEach(async () => {
  await app.redis.flushdb();
  // Also clear any matches written to Postgres during the previous test.
  await app.pg.query('TRUNCATE match_players, matches CASCADE');
});

afterAll(async () => {
  await app.redis.flushdb();
  await app.close();
});

// ── Helper ────────────────────────────────────────────────────────────────────

function joinQueue(user: TestUser, metadata?: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/matchmaking/join',
    headers: bearer(user.accessToken),
    payload: metadata ? { metadata } : {},
  });
}

async function matchesInDb(): Promise<{ id: string; players: string[] }[]> {
  const { rows: matchRows } = await app.pg.query<{ id: string }>(
    'SELECT id FROM matches ORDER BY created_at'
  );
  return Promise.all(
    matchRows.map(async ({ id }) => {
      const { rows } = await app.pg.query<{ user_id: string }>(
        'SELECT user_id FROM match_players WHERE match_id = $1',
        [id]
      );
      return { id, players: rows.map(r => r.user_id) };
    })
  );
}

// ── RC1: Duplicate-join race (TOCTOU) ────────────────────────────────────────

describe('RC1 — duplicate-join race condition', () => {
  it('only one of 2 concurrent joins for the same user succeeds', async () => {
    const [u] = users;

    const results = await Promise.all([joinQueue(u), joinQueue(u)]);
    const statuses = results.map(r => r.statusCode).sort();

    expect(statuses).toEqual([200, 409]);
  });

  it('only one of 5 concurrent joins for the same user succeeds', async () => {
    const [u] = users;
    const CONCURRENCY = 5;

    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => joinQueue(u))
    );
    const statuses = results.map(r => r.statusCode);

    expect(statuses.filter(s => s === 200)).toHaveLength(1);
    expect(statuses.filter(s => s === 409)).toHaveLength(CONCURRENCY - 1);
  });

  it('the successful join is reflected in queue status', async () => {
    const [u] = users;

    await Promise.all([joinQueue(u), joinQueue(u), joinQueue(u)]);

    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/matchmaking/status',
      headers: bearer(u.accessToken),
    });
    expect(statusRes.statusCode).toBe(200);
    expect(JSON.parse(statusRes.body).data.inQueue).toBe(true);
  });
});

// ── RC2: Double-match race (concurrent tryMatch) ─────────────────────────────

describe('RC2 — double-match race condition', () => {
  it('two players joining concurrently produce exactly one match', async () => {
    const [u1, u2] = users;

    const [res1, res2] = await Promise.all([joinQueue(u1), joinQueue(u2)]);

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);

    const db = await matchesInDb();
    expect(db).toHaveLength(1);
    expect(db[0].players).toHaveLength(2);
    expect(db[0].players).toContain(u1.id);
    expect(db[0].players).toContain(u2.id);
  });

  it('four players joining concurrently produce exactly two matches with no player in both', async () => {
    const [u1, u2, u3, u4] = users;

    const results = await Promise.all([
      joinQueue(u1),
      joinQueue(u2),
      joinQueue(u3),
      joinQueue(u4),
    ]);

    expect(results.every(r => r.statusCode === 200)).toBe(true);

    const db = await matchesInDb();
    expect(db).toHaveLength(2);

    const allMatchedPlayers = db.flatMap(m => m.players);
    // Every player appears in exactly one match — no duplicates.
    const uniquePlayers = new Set(allMatchedPlayers);
    expect(uniquePlayers.size).toBe(4);
    expect(allMatchedPlayers).toHaveLength(4);
  });

  it('no player is silently lost when 6 players join concurrently', async () => {
    const results = await Promise.all(users.map(u => joinQueue(u)));

    expect(results.every(r => r.statusCode === 200)).toBe(true);

    const db = await matchesInDb();
    // 6 players / MATCH_SIZE(2) = 3 matches
    expect(db).toHaveLength(3);

    const allMatchedPlayers = db.flatMap(m => m.players);
    const uniquePlayers = new Set(allMatchedPlayers);
    expect(uniquePlayers.size).toBe(6);

    // All original user IDs appear exactly once
    for (const u of users) {
      expect(uniquePlayers.has(u.id)).toBe(true);
    }
  });
});

// ── RC3: Concurrent leave ─────────────────────────────────────────────────────

describe('RC3 — concurrent leave race condition', () => {
  it('only one of 2 concurrent leaves for the same player succeeds', async () => {
    const [u] = users;

    await joinQueue(u);

    const [res1, res2] = await Promise.all([
      app.inject({ method: 'POST', url: '/api/v1/matchmaking/leave', headers: bearer(u.accessToken) }),
      app.inject({ method: 'POST', url: '/api/v1/matchmaking/leave', headers: bearer(u.accessToken) }),
    ]);

    const statuses = [res1.statusCode, res2.statusCode].sort();
    expect(statuses).toEqual([200, 404]);
  });

  it('the player is no longer in the queue after concurrent leaves', async () => {
    const [u] = users;

    await joinQueue(u);
    await Promise.all([
      app.inject({ method: 'POST', url: '/api/v1/matchmaking/leave', headers: bearer(u.accessToken) }),
      app.inject({ method: 'POST', url: '/api/v1/matchmaking/leave', headers: bearer(u.accessToken) }),
    ]);

    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/matchmaking/status',
      headers: bearer(u.accessToken),
    });
    expect(JSON.parse(statusRes.body).data.inQueue).toBe(false);
  });
});
