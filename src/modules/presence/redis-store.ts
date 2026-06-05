import type Redis from 'ioredis';
import type { IPresenceStore } from './store.interface';
import type { UserPresence, PresenceStatus } from './types';

// Key schema:
//   presence:user:{userId}  → JSON { status, lastSeen, socketId? }   with TTL
//   presence:online          → Redis SET of currently-online userIds
const KEY_PREFIX = 'presence:user:';
const ONLINE_SET = 'presence:online';

// Online TTL: 1 hour. Prevents stale "online" entries when a server crashes
// without firing a disconnect event. WebSocket heartbeats will refresh it (future).
const TTL_ONLINE_S = 3_600;

interface PresencePayload {
  status: PresenceStatus;
  lastSeen: string; // ISO 8601
  socketId?: string | null;
}

function key(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export class RedisPresenceStore implements IPresenceStore {
  constructor(private readonly redis: Redis) {}

  async setOnline(userId: string, socketId?: string): Promise<void> {
    const payload: PresencePayload = {
      status: 'online',
      lastSeen: new Date().toISOString(),
      socketId: socketId ?? null,
    };
    // Atomic pipeline — both writes succeed or both fail
    await this.redis
      .pipeline()
      .set(key(userId), JSON.stringify(payload), 'EX', TTL_ONLINE_S)
      .sadd(ONLINE_SET, userId)
      .exec();
  }

  async setOffline(userId: string): Promise<void> {
    // Delete the key (user is offline → no need to cache that state)
    // and remove from the online set atomically
    await this.redis.pipeline().del(key(userId)).srem(ONLINE_SET, userId).exec();
  }

  async getPresence(userId: string): Promise<UserPresence | null> {
    const raw = await this.redis.get(key(userId));
    if (!raw) return null;

    const payload = JSON.parse(raw) as PresencePayload;
    return {
      userId,
      status: payload.status,
      lastSeen: new Date(payload.lastSeen),
      socketId: payload.socketId ?? undefined,
    };
  }

  async getOnlineUsers(): Promise<UserPresence[]> {
    const userIds = await this.redis.smembers(ONLINE_SET);
    if (userIds.length === 0) return [];

    // Batch fetch all presence keys in one round-trip
    const keys = userIds.map(key);
    const values = await this.redis.mget(keys);

    const stale: string[] = [];
    const presences: UserPresence[] = [];

    for (let i = 0; i < userIds.length; i++) {
      const raw = values[i];
      if (!raw) {
        // TTL expired (e.g. server crash) but set wasn't cleaned up — collect for removal
        stale.push(userIds[i]);
        continue;
      }
      const payload = JSON.parse(raw) as PresencePayload;
      presences.push({
        userId: userIds[i],
        status: payload.status,
        lastSeen: new Date(payload.lastSeen),
        socketId: payload.socketId ?? undefined,
      });
    }

    // Self-heal: clean up stale entries without blocking the response
    if (stale.length > 0) {
      this.redis.srem(ONLINE_SET, stale).catch(() => void 0);
    }

    return presences.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
  }
}
