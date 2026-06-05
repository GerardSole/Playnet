import type { Pool } from 'pg';
import type { IPresenceStore } from './store.interface';
import type { UserPresence } from './types';

const SELECT_PRESENCE = `
  user_id   AS "userId",
  status,
  last_seen AS "lastSeen",
  socket_id AS "socketId"
`;

export class PostgresPresenceStore implements IPresenceStore {
  constructor(private readonly db: Pool) {}

  async setOnline(userId: string, socketId?: string): Promise<void> {
    await this.db.query(
      `INSERT INTO user_presence (user_id, status, socket_id, last_seen)
       VALUES ($1, 'online', $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET status = 'online', socket_id = $2, last_seen = NOW()`,
      [userId, socketId ?? null]
    );
  }

  async setOffline(userId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO user_presence (user_id, status, socket_id, last_seen)
       VALUES ($1, 'offline', NULL, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET status = 'offline', socket_id = NULL, last_seen = NOW()`,
      [userId]
    );
  }

  async getPresence(userId: string): Promise<UserPresence | null> {
    const { rows } = await this.db.query<UserPresence>(
      `SELECT ${SELECT_PRESENCE} FROM user_presence WHERE user_id = $1`,
      [userId]
    );
    return rows[0] ?? null;
  }

  async getOnlineUsers(): Promise<UserPresence[]> {
    const { rows } = await this.db.query<UserPresence>(
      `SELECT ${SELECT_PRESENCE}
       FROM user_presence
       WHERE status = 'online'
       ORDER BY last_seen DESC`
    );
    return rows;
  }
}
