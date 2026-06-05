import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { createAndLogin, bearer, truncate, type TestUser } from './helpers';

let app: FastifyInstance;
let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  await truncate(app);
  alice = await createAndLogin(app);
  bob = await createAndLogin(app);
});

afterAll(async () => {
  await app.close();
});

// ── Send request ──────────────────────────────────────────────────────────────

describe('POST /api/v1/friends/request', () => {
  it('returns 401 without a token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/friends/request',
      payload: { targetUserId: bob.id },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when sending a request to yourself', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/friends/request',
      headers: bearer(alice.accessToken),
      payload: { targetUserId: alice.id },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 201 and creates a pending friend request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/friends/request',
      headers: bearer(alice.accessToken),
      payload: { targetUserId: bob.id },
    });
    expect(res.statusCode).toBe(201);
    const { data } = JSON.parse(res.body);
    expect(data.senderId).toBe(alice.id);
    expect(data.receiverId).toBe(bob.id);
    expect(data.status).toBe('pending');
    expect(data).toHaveProperty('id');
  });

  it('returns 409 when a pending request already exists', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/friends/request',
      headers: bearer(alice.accessToken),
      payload: { targetUserId: bob.id },
    });
    expect(res.statusCode).toBe(409);
  });
});

// ── Accept request ────────────────────────────────────────────────────────────

describe('POST /api/v1/friends/accept', () => {
  let requestId: string;

  beforeAll(async () => {
    // Read the pending request ID from Alice's perspective (it was created in previous suite)
    const { rows } = await app.pg.query<{ id: string }>(
      `SELECT id FROM friend_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'`,
      [alice.id, bob.id]
    );
    requestId = rows[0]?.id ?? '';
  });

  it('returns 404 when the requester (not receiver) tries to accept', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/friends/accept',
      headers: bearer(alice.accessToken), // alice is the sender, not the receiver
      payload: { requestId },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 200 when the receiver accepts, setting status to accepted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/friends/accept',
      headers: bearer(bob.accessToken),
      payload: { requestId },
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(data.status).toBe('accepted');
  });
});

// ── List friends ──────────────────────────────────────────────────────────────

describe('GET /api/v1/friends', () => {
  it('returns the accepted friend in the list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/friends',
      headers: bearer(alice.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((f: { id: string }) => f.id === bob.id)).toBe(true);
  });

  it('returns 401 without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/friends' });
    expect(res.statusCode).toBe(401);
  });
});

// ── Reject request ────────────────────────────────────────────────────────────

describe('POST /api/v1/friends/reject', () => {
  it('returns 200 and sets status to rejected', async () => {
    // Create two new users and a new request to reject
    const carol = await createAndLogin(app);
    const dave = await createAndLogin(app);

    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/v1/friends/request',
      headers: bearer(carol.accessToken),
      payload: { targetUserId: dave.id },
    });
    const requestId = JSON.parse(reqRes.body).data.id as string;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/friends/reject',
      headers: bearer(dave.accessToken),
      payload: { requestId },
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(data.status).toBe('rejected');
  });
});

// ── Remove friend ─────────────────────────────────────────────────────────────

describe('DELETE /api/v1/friends/:friendId', () => {
  it('returns 204 and removes the friendship', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/friends/${bob.id}`,
      headers: bearer(alice.accessToken),
    });
    expect(res.statusCode).toBe(204);
  });

  it('returns 404 when trying to remove a user who is not a friend', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/friends/${bob.id}`,
      headers: bearer(alice.accessToken),
    });
    expect(res.statusCode).toBe(404);
  });

  it('no longer shows the removed friend in the list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/friends',
      headers: bearer(alice.accessToken),
    });
    const { data } = JSON.parse(res.body);
    expect(data.some((f: { id: string }) => f.id === bob.id)).toBe(false);
  });
});
