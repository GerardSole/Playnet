import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { truncate } from './helpers';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  await truncate(app);
});

afterAll(async () => {
  await app.close();
});

// ── Register ──────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('returns 201 with user data (no password field)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'alice', email: 'alice@test.local', password: 'TestPass123!' },
    });
    expect(res.statusCode).toBe(201);
    const { data } = JSON.parse(res.body);
    expect(data).toMatchObject({ username: 'alice', email: 'alice@test.local' });
    expect(data).toHaveProperty('id');
    expect(data).not.toHaveProperty('password');
    expect(data).not.toHaveProperty('passwordHash');
  });

  it('returns 409 on duplicate email', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'bob', email: 'dup@test.local', password: 'TestPass123!' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'bob2', email: 'dup@test.local', password: 'TestPass123!' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 409 on duplicate username', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'charlie', email: 'charlie@test.local', password: 'TestPass123!' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'charlie', email: 'charlie2@test.local', password: 'TestPass123!' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 400 on password without uppercase letter', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'dave', email: 'dave@test.local', password: 'weakpass1' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 on password shorter than 8 characters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'eve', email: 'eve@test.local', password: 'Ab1!' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 on invalid username characters', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'User Name!', email: 'frank@test.local', password: 'TestPass123!' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  beforeAll(async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'loginuser', email: 'login@test.local', password: 'TestPass123!' },
    });
  });

  it('returns 200 with accessToken, refreshToken, and expiresIn', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'login@test.local', password: 'TestPass123!' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body).toHaveProperty('expiresIn');
    expect(typeof body.accessToken).toBe('string');
    expect(body.refreshToken).toHaveLength(128); // 64 bytes hex-encoded
  });

  it('returns 401 on wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'login@test.local', password: 'WrongPass999!' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 on unknown email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'nobody@test.local', password: 'TestPass123!' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ── Refresh ───────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  // Each test gets its own login session — refresh tokens are single-use.
  beforeAll(async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'refreshuser', email: 'refresh@test.local', password: 'TestPass123!' },
    });
  });

  async function freshLogin(): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'refresh@test.local', password: 'TestPass123!' },
    });
    return (JSON.parse(res.body) as { refreshToken: string }).refreshToken;
  }

  it('returns a new token pair on valid refresh', async () => {
    const token = await freshLogin();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: token },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('accessToken');
    expect(body.refreshToken).not.toBe(token); // token rotation
  });

  it('invalidates the old refresh token (token rotation)', async () => {
    const initialToken = await freshLogin();

    // Rotate the token
    const rotateRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: initialToken },
    });
    expect(rotateRes.statusCode).toBe(200);
    const newToken = (JSON.parse(rotateRes.body) as { refreshToken: string }).refreshToken;

    // Old token is now revoked
    const oldRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: initialToken },
    });
    expect(oldRes.statusCode).toBe(401);

    // New token is still valid
    const newRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: newToken },
    });
    expect(newRes.statusCode).toBe(200);
  });

  it('returns 400 on malformed token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'not-a-valid-token' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('returns 204 and revokes the refresh token', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { username: 'logoutuser', email: 'logout@test.local', password: 'TestPass123!' },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'logout@test.local', password: 'TestPass123!' },
    });
    const { refreshToken } = JSON.parse(loginRes.body) as { refreshToken: string };

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken },
    });
    expect(logoutRes.statusCode).toBe(204);

    // Revoked token can no longer be refreshed
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(refreshRes.statusCode).toBe(401);
  });
});
