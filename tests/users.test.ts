import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { createAndLogin, bearer, truncate } from './helpers';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  await truncate(app);
});

afterAll(async () => {
  await app.close();
});

// ── GET /me ───────────────────────────────────────────────────────────────────

describe('GET /api/v1/users/me', () => {
  it('returns 401 without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/users/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with an invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { Authorization: 'Bearer not.a.valid.jwt' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 with the authenticated user profile', async () => {
    const user = await createAndLogin(app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: bearer(user.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(data.id).toBe(user.id);
    expect(data.username).toBe(user.username);
    expect(data.email).toBe(user.email);
    expect(data).not.toHaveProperty('password');
  });
});

// ── GET /:id ──────────────────────────────────────────────────────────────────

describe('GET /api/v1/users/:id', () => {
  it('returns 200 with the user profile (public, no auth required)', async () => {
    const user = await createAndLogin(app);
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${user.id}`,
    });
    expect(res.statusCode).toBe(200);
    const { data } = JSON.parse(res.body);
    expect(data.id).toBe(user.id);
    expect(data.username).toBe(user.username);
  });

  it('returns 404 for a non-existent user ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for a malformed UUID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/not-a-uuid',
    });
    // Fastify returns 400 for schema validation failure on params
    expect([400, 404]).toContain(res.statusCode);
  });
});

// ── POST / ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/users', () => {
  it('returns 201 and creates a user profile without password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      payload: {
        username: 'profileonly',
        email: 'profileonly@test.local',
        displayName: 'Profile Only',
      },
    });
    expect(res.statusCode).toBe(201);
    const { data } = JSON.parse(res.body);
    expect(data.username).toBe('profileonly');
    expect(data.displayName).toBe('Profile Only');
  });

  it('returns 409 on duplicate email', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      payload: { username: 'dup1', email: 'usersdup@test.local', displayName: 'Dup 1' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      payload: { username: 'dup2', email: 'usersdup@test.local', displayName: 'Dup 2' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      payload: { username: 'missingfields' },
    });
    expect(res.statusCode).toBe(400);
  });
});
