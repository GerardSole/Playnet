/**
 * Distributed rate limiting tests.
 *
 * These tests verify three properties that only matter in a multi-instance
 * deployment and that would be silently wrong with the old LocalStore:
 *
 *   1. SHARED COUNTER — Two separate Redis connections (= two app instances)
 *      increment the same counter.  With LocalStore each instance kept its own
 *      counter, so N instances effectively allowed N × max requests.
 *
 *   2. ATOMICITY — Concurrent increments from multiple connections never lose
 *      a count.  The Lua script (INCR + PEXPIRE) runs as a single indivisible
 *      operation on the Redis server, so there are no race windows.
 *
 *   3. HTTP ENFORCEMENT — After instance A fills the counter, instance B
 *      returns 429 for the same client IP.  This is impossible with LocalStore
 *      because each process has its own in-memory map.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { env } from '../src/config/env';

// ── Internal type for @fastify/rate-limit RedisStore ─────────────────────────
// The store is not exported publicly; we require() it to test it directly.
interface RateLimitStore {
  key: string;
  incr(
    ip: string,
    cb: (err: Error | null, result?: { current: number; ttl: number }) => void,
    timeWindow: number,
    max: number
  ): void;
  child(opts: {
    continueExceeding: boolean;
    exponentialBackoff: boolean;
    routeInfo: { method: string; url: string };
  }): RateLimitStore;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const RedisStore = require('@fastify/rate-limit/store/RedisStore') as new (
  continueExceeding: boolean,
  exponentialBackoff: boolean,
  redis: Redis,
  nameSpace: string
) => RateLimitStore;

/** Promisified wrapper around RedisStore.incr */
function incr(
  store: RateLimitStore,
  ip: string,
  timeWindow: number,
  max: number
): Promise<{ current: number; ttl: number }> {
  return new Promise((resolve, reject) => {
    store.incr(ip, (err, result) => {
      if (err || !result) return reject(err ?? new Error('empty result'));
      resolve(result);
    }, timeWindow, max);
  });
}

/** Delete all rl:* keys from Redis using SCAN to avoid blocking O(N) KEYS */
async function flushRateLimitKeys(redis: Redis): Promise<void> {
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'rl:*', 'COUNT', 100);
    cursor = next;
    if (keys.length > 0) await redis.del(...keys);
  } while (cursor !== '0');
}

// ── Store-level tests ─────────────────────────────────────────────────────────
// Two independent Redis clients simulate two backend instances.  We test the
// store directly so these tests run without a full HTTP server.

describe('Distributed store — two Redis connections share the same counter', () => {
  let redis1: Redis;
  let redis2: Redis;
  const TIME_WINDOW_MS = 10_000;
  const MAX = 100;

  beforeAll(() => {
    // Both clients connect to the same Redis DB — they simulate two app instances.
    redis1 = new Redis(env.REDIS_URL);
    redis2 = new Redis(env.REDIS_URL);
  });

  afterAll(async () => {
    await flushRateLimitKeys(redis1);
    await Promise.all([redis1.quit(), redis2.quit()]);
  });

  beforeEach(async () => {
    await flushRateLimitKeys(redis1);
  });

  it('increment from connection 1 is visible to connection 2', async () => {
    const testKey = `test-shared-${Date.now()}`;
    const store1 = new RedisStore(false, false, redis1, testKey + '-');
    const store2 = new RedisStore(false, false, redis2, testKey + '-');
    const ip = 'client-a';

    const r1 = await incr(store1, ip, TIME_WINDOW_MS, MAX);
    expect(r1.current).toBe(1);

    // Connection 2 must see current = 2, not 1 — proving the counter is in Redis
    // and not in each connection's local memory.
    const r2 = await incr(store2, ip, TIME_WINDOW_MS, MAX);
    expect(r2.current).toBe(2);
  });

  it('counters for different IPs are independent', async () => {
    const ns = `test-ips-${Date.now()}-`;
    const store = new RedisStore(false, false, redis1, ns);

    const [rA, rB] = await Promise.all([
      incr(store, 'ip-alice', TIME_WINDOW_MS, MAX),
      incr(store, 'ip-bob', TIME_WINDOW_MS, MAX),
    ]);

    // Each IP starts at 1 — they don't share a counter
    expect(rA.current).toBe(1);
    expect(rB.current).toBe(1);
  });

  it('counter has a positive TTL (expires automatically)', async () => {
    const ns = `test-ttl-${Date.now()}-`;
    const store = new RedisStore(false, false, redis1, ns);

    await incr(store, 'ttl-client', TIME_WINDOW_MS, MAX);

    const ttlMs = await redis1.pttl(`${ns}ttl-client`);
    // TTL should be positive and not exceed the window
    expect(ttlMs).toBeGreaterThan(0);
    expect(ttlMs).toBeLessThanOrEqual(TIME_WINDOW_MS);
  });

  it('second window starts from 1 after TTL expires (key deleted)', async () => {
    const ns = `test-window-${Date.now()}-`;
    const store = new RedisStore(false, false, redis1, ns);
    const ip = 'window-client';

    await incr(store, ip, TIME_WINDOW_MS, MAX);

    // Manually delete the key to simulate window expiry
    await redis1.del(`${ns}${ip}`);

    // Next increment should start a new window at 1
    const r = await incr(store, ip, TIME_WINDOW_MS, MAX);
    expect(r.current).toBe(1);
  });
});

// ── Atomicity tests ───────────────────────────────────────────────────────────
// Concurrent increments from multiple connections must never lose a count.

describe('Atomicity — concurrent increments produce exact counts', () => {
  let redis1: Redis;
  let redis2: Redis;

  beforeAll(() => {
    redis1 = new Redis(env.REDIS_URL);
    redis2 = new Redis(env.REDIS_URL);
  });

  afterAll(async () => {
    await flushRateLimitKeys(redis1);
    await Promise.all([redis1.quit(), redis2.quit()]);
  });

  beforeEach(async () => {
    await flushRateLimitKeys(redis1);
  });

  it('50 concurrent increments from 2 connections produce exactly 50 as final count', async () => {
    const ns = `test-atomic-${Date.now()}-`;
    const store1 = new RedisStore(false, false, redis1, ns);
    const store2 = new RedisStore(false, false, redis2, ns);
    const ip = 'atomic-client';
    const CONCURRENCY = 25; // 25 per connection = 50 total

    const results = await Promise.all([
      ...Array.from({ length: CONCURRENCY }, () => incr(store1, ip, 60_000, 9999)),
      ...Array.from({ length: CONCURRENCY }, () => incr(store2, ip, 60_000, 9999)),
    ]);

    const counts = results.map(r => r.current);

    // All 50 increments must have produced distinct, consecutive values.
    // If any count were duplicated it would mean two operations collided
    // (race condition) and one increment was lost.
    const uniqueCounts = new Set(counts);
    expect(uniqueCounts.size).toBe(CONCURRENCY * 2);

    // The maximum count must equal the total number of operations.
    expect(Math.max(...counts)).toBe(CONCURRENCY * 2);
  });
});

// ── HTTP integration tests ────────────────────────────────────────────────────
// Two full app instances share the same Redis DB (same test Redis URL).
// We simulate instance A "filling" the rate limit counter so that instance B
// immediately returns 429 — proving enforcement is distributed, not local.

describe('HTTP — instance B is rate-limited after instance A fills the counter', () => {
  let instanceA: FastifyInstance;
  let instanceB: FastifyInstance;

  // Rate limit key for the default keyGenerator (IP-based) on a non-overridden route.
  // Format: {nameSpace}{clientIp}  →  rl:127.0.0.1  (app.inject uses 127.0.0.1)
  const GLOBAL_RL_KEY = 'rl:127.0.0.1';

  beforeAll(async () => {
    instanceA = await buildApp();
    instanceB = await buildApp();
    await instanceA.ready();
    await instanceB.ready();
  });

  afterAll(async () => {
    // Flush rate-limit keys so subsequent test files don't inherit a maxed-out
    // counter left behind by the last test in this describe block.
    await flushRateLimitKeys(instanceA.redis);
    await instanceA.close();
    await instanceB.close();
  });

  beforeEach(async () => {
    // Reset all rate limit keys before each test so they don't bleed across cases.
    await flushRateLimitKeys(instanceA.redis);
  });

  it('instance B returns 429 when instance A pre-fills the global counter to max', async () => {
    const max = env.RATE_LIMIT_MAX;

    // Simulate instance A having already absorbed all allowed requests by
    // directly writing the counter at max into the shared Redis.
    // The next INCR (from instance B's request) will produce max + 1 > max.
    await instanceA.redis.set(GLOBAL_RL_KEY, String(max), 'PX', 60_000);

    const res = await instanceB.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(429);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('instance A returns 429 when instance B pre-fills the counter', async () => {
    const max = env.RATE_LIMIT_MAX;

    // Same test in the opposite direction — proving it's symmetric.
    await instanceB.redis.set(GLOBAL_RL_KEY, String(max), 'PX', 60_000);

    const res = await instanceA.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(429);
  });

  it('rate limit resets after the time window expires (counter deleted from Redis)', async () => {
    const max = env.RATE_LIMIT_MAX;

    // Fill to max
    await instanceA.redis.set(GLOBAL_RL_KEY, String(max), 'PX', 60_000);

    // Simulate window expiry by deleting the key
    await instanceA.redis.del(GLOBAL_RL_KEY);

    // Both instances should now allow traffic again
    const [resA, resB] = await Promise.all([
      instanceA.inject({ method: 'GET', url: '/health' }),
      instanceB.inject({ method: 'GET', url: '/health' }),
    ]);

    expect(resA.statusCode).toBe(200);
    expect(resB.statusCode).toBe(200);
  });

  it('per-route auth limit uses a separate Redis key from the global limit', async () => {
    const max = env.RATE_LIMIT_MAX;

    // Fill the global rate limit key
    await instanceA.redis.set(GLOBAL_RL_KEY, String(max), 'PX', 60_000);

    // Auth routes use a per-route child store with a different key prefix:
    //   rl:POST/api/v1/auth/login-127.0.0.1
    // So an auth request should NOT be affected by the global counter being full.
    const loginRes = await instanceB.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'x@x.com', password: 'wrong' },
    });

    // 401 means the request reached the handler — not rate limited
    // (it fails auth because credentials are wrong, but not with 429)
    expect(loginRes.statusCode).not.toBe(429);
  });

  it('response headers include rate limit info on a successful request', async () => {
    const res = await instanceA.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    // Standard rate-limit headers must be present
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
  });

  it('429 response includes Retry-After header', async () => {
    const max = env.RATE_LIMIT_MAX;
    await instanceA.redis.set(GLOBAL_RL_KEY, String(max), 'PX', 60_000);

    const res = await instanceB.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});
