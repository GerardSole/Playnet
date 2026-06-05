import type { Pool } from 'pg';
import { ConflictError } from '../../shared/errors/AppError';
import type { FriendRequest, FriendProfile } from './types';

const SELECT_REQUEST = `
  id,
  sender_id   AS "senderId",
  receiver_id AS "receiverId",
  status,
  created_at  AS "createdAt",
  updated_at  AS "updatedAt"
`;

function isPgError(err: unknown): err is { code: string } {
  return err instanceof Error && 'code' in err;
}

export class FriendsRepository {
  constructor(private readonly db: Pool) {}

  // Inserts a new pending request.
  // If a rejected request from the same sender already exists, it is reactivated to
  // 'pending' (so re-requesting after rejection works).
  // If the conflict is with a pending or accepted request, returns 0 rows → service throws.
  async createRequest(senderId: string, receiverId: string): Promise<FriendRequest | null> {
    try {
      const { rows } = await this.db.query<FriendRequest>(
        `INSERT INTO friend_requests (sender_id, receiver_id)
         VALUES ($1, $2)
         ON CONFLICT (sender_id, receiver_id) DO UPDATE
           SET status     = 'pending',
               updated_at = NOW()
         WHERE friend_requests.status = 'rejected'
         RETURNING ${SELECT_REQUEST}`,
        [senderId, receiverId]
      );
      return rows[0] ?? null;
    } catch (err) {
      // 23514 = check_violation (sender_id = receiver_id caught at DB level)
      if (isPgError(err) && err.code === '23514') {
        throw new ConflictError('Cannot send friend request to yourself');
      }
      throw err;
    }
  }

  // Finds a pending request where the caller is the receiver — for accept / reject.
  // Scoped to receiverId so users can only respond to their own requests.
  async findPendingForReceiver(requestId: string, receiverId: string): Promise<FriendRequest | null> {
    const { rows } = await this.db.query<FriendRequest>(
      `SELECT ${SELECT_REQUEST}
       FROM friend_requests
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'`,
      [requestId, receiverId]
    );
    return rows[0] ?? null;
  }

  // Finds any pending request between two users in either direction.
  async findPendingBetween(userA: string, userB: string): Promise<FriendRequest | null> {
    const { rows } = await this.db.query<FriendRequest>(
      `SELECT ${SELECT_REQUEST}
       FROM friend_requests
       WHERE ((sender_id = $1 AND receiver_id = $2)
           OR (sender_id = $2 AND receiver_id = $1))
         AND status = 'pending'`,
      [userA, userB]
    );
    return rows[0] ?? null;
  }

  async isFriends(userA: string, userB: string): Promise<boolean> {
    const { rows } = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2
       ) AS exists`,
      [userA, userB]
    );
    return rows[0].exists;
  }

  // Atomically: mark request as accepted + insert both friendship rows.
  async acceptAndCreateFriendship(
    requestId: string,
    senderUserId: string,
    receiverUserId: string
  ): Promise<FriendRequest> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<FriendRequest>(
        `UPDATE friend_requests
         SET status = 'accepted', updated_at = NOW()
         WHERE id = $1
         RETURNING ${SELECT_REQUEST}`,
        [requestId]
      );
      await client.query(
        `INSERT INTO friendships (user_id, friend_id)
         VALUES ($1, $2), ($3, $4)
         ON CONFLICT DO NOTHING`,
        [senderUserId, receiverUserId, receiverUserId, senderUserId]
      );
      await client.query('COMMIT');
      return rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async rejectRequest(requestId: string): Promise<FriendRequest> {
    const { rows } = await this.db.query<FriendRequest>(
      `UPDATE friend_requests
       SET status = 'rejected', updated_at = NOW()
       WHERE id = $1
       RETURNING ${SELECT_REQUEST}`,
      [requestId]
    );
    return rows[0];
  }

  async listFriends(userId: string): Promise<FriendProfile[]> {
    const { rows } = await this.db.query<FriendProfile>(
      `SELECT u.id,
              u.username,
              u.display_name AS "displayName",
              u.avatar_url   AS "avatarUrl"
       FROM friendships f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = $1
       ORDER BY u.username`,
      [userId]
    );
    return rows;
  }

  // Atomically deletes both friendship rows.
  // Returns true if the friendship existed, false if it did not.
  async removeFriendship(userId: string, friendId: string): Promise<boolean> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const { rowCount } = await client.query(
        `DELETE FROM friendships WHERE user_id = $1 AND friend_id = $2`,
        [userId, friendId]
      );
      await client.query(
        `DELETE FROM friendships WHERE user_id = $1 AND friend_id = $2`,
        [friendId, userId]
      );
      await client.query('COMMIT');
      return (rowCount ?? 0) > 0;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
