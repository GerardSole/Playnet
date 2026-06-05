import type { Pool } from 'pg';
import { ConflictError } from '../../shared/errors/AppError';
import type { RegisteredUser, UserWithPassword } from './types';

interface CreateUserData {
  username: string;
  email: string;
  displayName: string;
  passwordHash: string;
}

interface StoredRefreshToken {
  id: string;
  userId: string;
}

// Returns camelCase column names via SQL aliases — no mapping layer needed.
const SELECT_PUBLIC = `
  id,
  username,
  email,
  display_name  AS "displayName",
  avatar_url    AS "avatarUrl",
  created_at    AS "createdAt",
  updated_at    AS "updatedAt"
`;

function isPgError(err: unknown): err is { code: string } {
  return err instanceof Error && 'code' in err;
}

export class AuthRepository {
  constructor(private readonly db: Pool) {}

  // ─── User queries ───────────────────────────────────────────────────────────

  async createUser(data: CreateUserData): Promise<RegisteredUser> {
    try {
      const { rows } = await this.db.query<RegisteredUser>(
        `INSERT INTO users (username, email, display_name, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING ${SELECT_PUBLIC}`,
        [data.username, data.email, data.displayName, data.passwordHash]
      );
      return rows[0];
    } catch (err) {
      if (isPgError(err) && err.code === '23505') {
        throw new ConflictError('Email or username already in use');
      }
      throw err;
    }
  }

  async existsByEmailOrUsername(email: string, username: string): Promise<boolean> {
    const { rows } = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM users WHERE email = $1 OR username = $2
       ) AS exists`,
      [email, username]
    );
    return rows[0].exists;
  }

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    const { rows } = await this.db.query<UserWithPassword>(
      `SELECT ${SELECT_PUBLIC},
              password_hash AS "passwordHash"
       FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] ?? null;
  }

  // ─── Refresh token queries ──────────────────────────────────────────────────

  // Simple unconditional insert — no session-limit enforcement.
  // Prefer storeRefreshTokenEnforceLimit for user-facing login flows.
  async storeRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );
  }

  // Atomically evicts over-limit sessions then inserts the new one.
  //
  // Eviction policy: LRU — the session with the oldest last_used_at is removed
  // first.  An active session (one that keeps rotating its token) advances its
  // last_used_at on every /refresh call and is therefore the last to be evicted.
  //
  // All three operations (evict expired, evict over-limit, insert) run inside a
  // single transaction, so two concurrent logins cannot both see "N-1 sessions"
  // and both skip eviction, ending up with N+1 sessions.
  async storeRefreshTokenEnforceLimit(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    maxSessions: number
  ): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Step 1 — housekeeping: remove expired tokens so they do not count toward
      // the session quota or inflate the NOT IN subquery.
      await client.query(
        `DELETE FROM refresh_tokens
         WHERE user_id = $1 AND expires_at <= NOW()`,
        [userId]
      );

      // Step 2 — evict LRU sessions that exceed (maxSessions - 1) so that after
      // inserting the new session the total stays at or below maxSessions.
      //
      // The NOT IN subquery keeps the (maxSessions - 1) most recently used
      // non-expired sessions; anything else is deleted.
      //
      // Using NOT IN is safe here because the subquery returns UUIDs (never NULL)
      // and the set is small (bounded by maxSessions).
      await client.query(
        `DELETE FROM refresh_tokens
         WHERE user_id = $1
           AND id NOT IN (
             SELECT id FROM refresh_tokens
             WHERE user_id = $1
             ORDER BY last_used_at DESC, created_at DESC
             LIMIT $2
           )`,
        [userId, maxSessions - 1]
      );

      // Step 3 — insert the new session.
      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Returns null when token is not found OR already expired
  async findRefreshToken(tokenHash: string): Promise<StoredRefreshToken | null> {
    const { rows } = await this.db.query<StoredRefreshToken>(
      `SELECT id, user_id AS "userId"
       FROM refresh_tokens
       WHERE token_hash = $1 AND expires_at > NOW()`,
      [tokenHash]
    );
    return rows[0] ?? null;
  }

  // Atomically replaces old token hash with new one using a single UPDATE.
  //
  // Why UPDATE instead of DELETE + INSERT:
  //   The old implementation used DELETE + INSERT inside a transaction.  Two
  //   concurrent /refresh calls with the same token would both succeed: the
  //   first deleted the original row, the second found nothing to delete but
  //   still inserted a new row, silently creating an orphan session.
  //
  //   With UPDATE, only the call that finds token_hash = oldHash succeeds.  The
  //   second concurrent call gets rowCount = 0 and the service returns 401.
  //
  // Additionally, preserving the row means created_at stays as the true session
  // birth timestamp, while last_used_at advances on each rotation — enabling
  // accurate LRU eviction in storeRefreshTokenEnforceLimit.
  //
  // Returns true when the token was found and rotated, false when not found or
  // already expired (concurrent reuse).
  async rotateRefreshToken(
    oldHash: string,
    userId: string,
    newHash: string,
    expiresAt: Date
  ): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE refresh_tokens
       SET token_hash = $3,
           expires_at = $4,
           last_used_at = NOW()
       WHERE token_hash = $1
         AND user_id    = $2
         AND expires_at > NOW()`,
      [oldHash, userId, newHash, expiresAt]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // Idempotent — silently succeeds if token not found (already revoked)
  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.db.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
  }
}
