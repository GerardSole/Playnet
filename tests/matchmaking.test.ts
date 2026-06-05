import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { createAndLogin, bearer, truncate, type TestUser } from './helpers';

let app: FastifyInstance;
let user1: TestUser;
let user2: TestUser;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  await truncate(app);
  await app.redis.flushdb();
  user1 = await createAndLogin(app);
  user2 = await createAndLogin(app);
});

beforeEach(async () => {
  // Reset queue state before each test
  await app.redis.flushdb();
});

afterAll(async () => {
  await app.redis.flushdb();
  await app.close();
});

// ── Join queue ────────────────────────────────────────────────────────────────

describe('POST /api/v1/matchmaking/join', () => {
  it('returns 401 without a token', async () => {
    // Send empty body so AJV passes and only auth is checked
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/matchmaking/join',
      payload: {},
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 and queues the player (no match yet with one player)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/matchmaking/join',
      headers: bearer(user1.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(data.inQueue).toBe(true);
    expect(data).toHaveProperty('queuedAt');
    expect(data.match).toBeNull();
  });

  it('returns 409 when the player is already in the queue', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/matchmaking/join',
      headers: bearer(user1.accessToken),
      payload: {},
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/matchmaking/join',
      headers: bearer(user1.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(409);
  });

  it('creates a match when two players join', async () => {
    // user1 joins first — no match yet
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/matchmaking/join',
      headers: bearer(user1.accessToken),
      payload: {},
    });
    expect(res1.statusCode).toBe(200);
    expect(JSON.parse(res1.body).data.match).toBeNull();

    // user2 joins — match created immediately
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/matchmaking/join',
      headers: bearer(user2.accessToken),
      payload: {},
    });
    expect(res2.statusCode).toBe(200);
    const { data } = JSON.parse(res2.body);
    expect(data.match).not.toBeNull();
    expect(data.match.matchId).toBeTruthy();
    expect(data.match.players).toHaveLength(2);
    expect(data.match.players).toContain(user1.id);
    expect(data.match.players).toContain(user2.id);
  });

  it('accepts optional metadata in the request body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/matchmaking/join',
      headers: bearer(user1.accessToken),
      payload: { metadata: { region: 'eu-west', mode: 'ranked' } },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.inQueue).toBe(true);
  });
});

// ── Queue status ──────────────────────────────────────────────────────────────

describe('GET /api/v1/matchmaking/status', () => {
  it('returns inQueue=false when not queued', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/matchmaking/status',
      headers: bearer(user1.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.inQueue).toBe(false);
  });

  it('returns inQueue=true and queuedAt after joining', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/matchmaking/join',
      headers: bearer(user1.accessToken),
      payload: {},
    });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/matchmaking/status',
      headers: bearer(user1.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(data.inQueue).toBe(true);
    expect(data).toHaveProperty('queuedAt');
  });

  it('returns 401 without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/matchmaking/status' });
    expect(res.statusCode).toBe(401);
  });
});

// ── Leave queue ───────────────────────────────────────────────────────────────

describe('POST /api/v1/matchmaking/leave', () => {
  it('returns 200 and removes the player from the queue', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/matchmaking/join',
      headers: bearer(user1.accessToken),
      payload: {},
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/matchmaking/leave',
      headers: bearer(user1.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.inQueue).toBe(false);

    // Status confirms the player is no longer queued
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/matchmaking/status',
      headers: bearer(user1.accessToken),
    });
    expect(JSON.parse(statusRes.body).data.inQueue).toBe(false);
  });

  it('returns 404 when the player is not in the queue', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/matchmaking/leave',
      headers: bearer(user1.accessToken),
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/matchmaking/leave' });
    expect(res.statusCode).toBe(401);
  });
});
