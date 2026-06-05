import type { FastifyInstance } from 'fastify';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns an Authorization header object for use with app.inject(). */
export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/** Registers a user WITHOUT logging in. Use when you only need a user ID and credentials but no active session. */
export async function createUser(
  app: FastifyInstance,
  overrides: { username?: string; email?: string; password?: string } = {}
): Promise<{ id: string; username: string; email: string; password: string }> {
  const suffix = Math.random().toString(36).slice(2, 9);
  const username = overrides.username ?? `user_${suffix}`;
  const email = overrides.email ?? `${username}@test.local`;
  const password = overrides.password ?? 'TestPass123!';

  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { username, email, password, displayName: username },
  });

  if (res.statusCode !== 201) {
    throw new Error(`createUser: register failed ${res.statusCode} — ${res.body}`);
  }

  const user = JSON.parse(res.body).data as { id: string; username: string };
  return { id: user.id, username, email, password };
}

/** Registers a user and logs them in, returning all credentials. */
export async function createAndLogin(
  app: FastifyInstance,
  overrides: { username?: string; email?: string; password?: string } = {}
): Promise<TestUser> {
  const suffix = Math.random().toString(36).slice(2, 9);
  const username = overrides.username ?? `user_${suffix}`;
  const email = overrides.email ?? `${username}@test.local`;
  const password = overrides.password ?? 'TestPass123!';

  const regRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: { username, email, password, displayName: username },
  });

  if (regRes.statusCode !== 201) {
    throw new Error(`createAndLogin: register failed ${regRes.statusCode} — ${regRes.body}`);
  }

  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email, password },
  });

  if (loginRes.statusCode !== 200) {
    throw new Error(`createAndLogin: login failed ${loginRes.statusCode} — ${loginRes.body}`);
  }

  const user = JSON.parse(regRes.body).data as { id: string; username: string };
  const tokens = JSON.parse(loginRes.body) as { accessToken: string; refreshToken: string };

  return { id: user.id, username, email, password, ...tokens };
}

/** Truncates all application tables, leaving schema_migrations intact. */
export async function truncate(app: FastifyInstance): Promise<void> {
  await app.pg.query(`
    TRUNCATE
      notifications,
      leaderboard_scores,
      leaderboards,
      match_players,
      matches,
      user_presence,
      friendships,
      friend_requests,
      refresh_tokens,
      users
    CASCADE
  `);
}
