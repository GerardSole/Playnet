import type { Pool } from 'pg';
import type { Notification, NotificationType } from './types';

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: Date;
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as NotificationType,
    payload: row.payload,
    read: row.read,
    createdAt: row.created_at,
  };
}

export class NotificationsRepository {
  constructor(private readonly pg: Pool) {}

  async create(
    userId: string,
    type: NotificationType,
    payload: Record<string, unknown>
  ): Promise<Notification> {
    const result = await this.pg.query<NotificationRow>(
      `INSERT INTO notifications (user_id, type, payload)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, type, payload, read, created_at`,
      [userId, type, JSON.stringify(payload)]
    );
    return toNotification(result.rows[0]);
  }

  async list(
    userId: string,
    options: { unreadOnly: boolean; page: number; limit: number }
  ): Promise<{ notifications: Notification[]; total: number }> {
    const { unreadOnly, page, limit } = options;
    const offset = (page - 1) * limit;

    // NOT $2::boolean OR read = FALSE
    //   unreadOnly=false → NOT false = true  → all rows pass
    //   unreadOnly=true  → NOT true  = false → only unread rows pass
    const [listResult, countResult] = await Promise.all([
      this.pg.query<NotificationRow>(
        `SELECT id, user_id, type, payload, read, created_at
         FROM notifications
         WHERE user_id = $1 AND (NOT $2::boolean OR read = FALSE)
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [userId, unreadOnly, limit, offset]
      ),
      this.pg.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM notifications
         WHERE user_id = $1 AND (NOT $2::boolean OR read = FALSE)`,
        [userId, unreadOnly]
      ),
    ]);

    return {
      notifications: listResult.rows.map(toNotification),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  // Only marks notifications that belong to userId — prevents marking others' notifications
  async markRead(userId: string, ids: string[]): Promise<void> {
    await this.pg.query(
      `UPDATE notifications
       SET read = TRUE
       WHERE user_id = $1 AND id = ANY($2::uuid[]) AND read = FALSE`,
      [userId, ids]
    );
  }
}
