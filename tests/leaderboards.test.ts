import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { createAndLogin, bearer, truncate, type TestUser } from './helpers';

let app: FastifyInstance;
let user: TestUser;
let leaderboardId: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  await truncate(app);
  user = await createAndLogin(app);

  // Create a shared leaderboard used by most tests
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/leaderboards',
    headers: bearer(user.accessToken),
    payload: { name: 'Test Leaderboard' },
  });
  leaderboardId = JSON.parse(res.body).data.id as string;
});

afterAll(async () => {
  await app.close();
});

// ── Create leaderboard ────────────────────────────────────────────────────────

describe('POST /api/v1/leaderboards', () => {
  it('returns 401 without a token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/leaderboards',
      payload: { name: 'Unauthorized Board' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 201 with leaderboard data', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/leaderboards',
      headers: bearer(user.accessToken),
      payload: { name: 'New Board' },
    });
    expect(res.statusCode).toBe(201);
    const { data } = JSON.parse(res.body);
    expect(data.name).toBe('New Board');
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('createdAt');
  });

  it('returns 409 on duplicate leaderboard name', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/leaderboards',
      headers: bearer(user.accessToken),
      payload: { name: 'Unique Board' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/leaderboards',
      headers: bearer(user.accessToken),
      payload: { name: 'Unique Board' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 400 when name is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/leaderboards',
      headers: bearer(user.accessToken),
      payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── Submit score ──────────────────────────────────────────────────────────────

describe('POST /api/v1/leaderboards/:id/submit', () => {
  it('returns 401 without a token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/leaderboards/${leaderboardId}/submit`,
      payload: { score: 500 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 for a non-existent leaderboard', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/leaderboards/00000000-0000-0000-0000-000000000000/submit',
      headers: bearer(user.accessToken),
      payload: { score: 500 },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 200 with the player rank after submitting', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/leaderboards/${leaderboardId}/submit`,
      headers: bearer(user.accessToken),
      payload: { score: 1000 },
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(data.score).toBe(1000);
    expect(data.rank).toBe(1);
    expect(data).toHaveProperty('userId');
    expect(data).toHaveProperty('updatedAt');
  });

  it('keeps the best (highest) score — lower submission has no effect', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/v1/leaderboards/${leaderboardId}/submit`,
      headers: bearer(user.accessToken),
      payload: { score: 1000 },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/leaderboards/${leaderboardId}/submit`,
      headers: bearer(user.accessToken),
      payload: { score: 500 }, // lower than current 1000
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.score).toBe(1000); // score unchanged
  });

  it('updates the score when a higher score is submitted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/leaderboards/${leaderboardId}/submit`,
      headers: bearer(user.accessToken),
      payload: { score: 9999 },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.score).toBe(9999);
  });

  it('returns 400 for a negative score', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/leaderboards/${leaderboardId}/submit`,
      headers: bearer(user.accessToken),
      payload: { score: -1 },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── Get rankings ──────────────────────────────────────────────────────────────

describe('GET /api/v1/leaderboards/:id', () => {
  let lb2Id: string;
  let player1: TestUser;
  let player2: TestUser;
  let player3: TestUser;

  beforeAll(async () => {
    // Create a fresh leaderboard and 3 players with distinct scores
    const lbRes = await app.inject({
      method: 'POST',
      url: '/api/v1/leaderboards',
      headers: bearer(user.accessToken),
      payload: { name: 'Rankings Board' },
    });
    lb2Id = JSON.parse(lbRes.body).data.id as string;

    player1 = await createAndLogin(app);
    player2 = await createAndLogin(app);
    player3 = await createAndLogin(app);

    for (const [p, score] of [[player1, 3000], [player2, 1000], [player3, 2000]] as const) {
      await app.inject({
        method: 'POST',
        url: `/api/v1/leaderboards/${lb2Id}/submit`,
        headers: bearer(p.accessToken),
        payload: { score },
      });
    }
  });

  it('returns 200 with entries ordered by score descending', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/leaderboards/${lb2Id}`,
      headers: bearer(user.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const { data, meta } = JSON.parse(res.body);

    expect(data.leaderboard.name).toBe('Rankings Board');
    expect(data.entries).toHaveLength(3);
    expect(meta.total).toBe(3);

    // Verify descending score order and correct rank assignment
    expect(data.entries[0].score).toBe(3000);
    expect(data.entries[0].rank).toBe(1);
    expect(data.entries[1].score).toBe(2000);
    expect(data.entries[1].rank).toBe(2);
    expect(data.entries[2].score).toBe(1000);
    expect(data.entries[2].rank).toBe(3);
  });

  it('respects pagination parameters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/leaderboards/${lb2Id}?page=1&limit=2`,
      headers: bearer(user.accessToken),
    });
    const { data, meta } = JSON.parse(res.body);
    expect(data.entries).toHaveLength(2);
    expect(meta.page).toBe(1);
    expect(meta.limit).toBe(2);
    expect(meta.total).toBe(3);

    const res2 = await app.inject({
      method: 'GET',
      url: `/api/v1/leaderboards/${lb2Id}?page=2&limit=2`,
      headers: bearer(user.accessToken),
    });
    expect(JSON.parse(res2.body).data.entries).toHaveLength(1);
  });

  it('returns 404 for a non-existent leaderboard', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/leaderboards/00000000-0000-0000-0000-000000000000',
      headers: bearer(user.accessToken),
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/leaderboards/${lb2Id}` });
    expect(res.statusCode).toBe(401);
  });
});

// ── Get player rank ───────────────────────────────────────────────────────────

describe('GET /api/v1/leaderboards/:id/player/:playerId', () => {
  it('returns the correct rank and score for a player', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/leaderboards/${leaderboardId}/player/${user.id}`,
      headers: bearer(user.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(data.userId).toBe(user.id);
    expect(data.score).toBe(9999); // highest score submitted in earlier tests
    expect(data.rank).toBe(1);
  });

  it('returns 404 when the player has not submitted a score', async () => {
    const newcomer = await createAndLogin(app);
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/leaderboards/${leaderboardId}/player/${newcomer.id}`,
      headers: bearer(user.accessToken),
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for a non-existent leaderboard', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/leaderboards/00000000-0000-0000-0000-000000000000/player/${user.id}`,
      headers: bearer(user.accessToken),
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 401 without a token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/leaderboards/${leaderboardId}/player/${user.id}`,
    });
    expect(res.statusCode).toBe(401);
  });
});
