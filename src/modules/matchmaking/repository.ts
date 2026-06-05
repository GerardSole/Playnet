import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type Redis from 'ioredis';
import type { QueueEntry, Match } from './types';

// Redis key schema:
//   matchmaking:queue              → Sorted Set  { member: userId, score: epoch ms }
//   matchmaking:player:{userId}    → String (JSON QueueEntry)  TTL = 1h
//
// The sorted set is the authoritative source of truth for queue membership.
// The string key stores entry metadata for efficient single-player lookups.
const QUEUE_KEY = 'matchmaking:queue';
const PLAYER_PREFIX = 'matchmaking:player:';
const PLAYER_TTL_S = 3_600;

// ─── Lua script: atomic enqueue-if-not-exists ────────────────────────────────
//
// WHY LUA:
//   A plain GET → check → MULTI/EXEC sequence (the previous approach) has a
//   TOCTOU race window: two concurrent requests for the same userId both read
//   a missing key, both pass the "not in queue" guard, and both enqueue the
//   player. The player ends up with two HTTP 200 responses and tryMatch() is
//   called twice.
//
//   This script collapses the check-and-write into a single atomic operation on
//   the Redis server. No other command can observe the key between EXISTS and
//   SET, so the race window is closed.
//
// KEYS[1]  = sorted set (queue)
// KEYS[2]  = player metadata key  (matchmaking:player:{userId})
// ARGV[1]  = userId (sorted-set member)
// ARGV[2]  = score (epoch ms, as string)
// ARGV[3]  = metadata JSON
// ARGV[4]  = TTL in seconds
//
// Returns: 1 if newly enqueued
//          0 if the player was already in the queue (key existed)
const ENQUEUE_NX_SCRIPT = `
if redis.call('EXISTS', KEYS[2]) == 1 then
  return 0
end
redis.call('SET', KEYS[2], ARGV[3], 'EX', tonumber(ARGV[4]))
redis.call('ZADD', KEYS[1], tonumber(ARGV[2]), ARGV[1])
return 1
`;

// ─── Lua script: atomic pop ───────────────────────────────────────────────────
//
// WHY LUA:
//   The old implementation used a two-step sequence — ZPOPMIN, then re-enqueue
//   if the pop returned fewer players than needed. The gap between those two
//   Redis calls was a race condition: if the process crashed or Redis lost the
//   connection between ZPOPMIN and re-enqueue, the partially-popped players
//   were silently lost from the queue with no error surfaced to the client.
//
//   A Lua script runs atomically on the Redis server — no other client command
//   can interleave while it executes. By making the ZCARD check and ZPOPMIN a
//   single indivisible operation we guarantee:
//     (a) partial pops are impossible → re-enqueue is unnecessary
//     (b) a player cannot be popped by two concurrent requests
//     (c) if the queue has fewer players than needed, nothing is touched
//
// KEYS[1]  = sorted set (queue)
// ARGV[1]  = match size (number of players to pop)
// ARGV[2]  = player key prefix ("matchmaking:player:")
//
// Returns: [] if queue size < match_size (no side effects)
//          flat array [userId1, metadata_json1, userId2, metadata_json2, ...]
//            where metadata_json is '' when the player key has expired (TTL)
const POP_MATCH_SCRIPT = `
local count  = tonumber(ARGV[1])
local prefix = ARGV[2]

if redis.call('ZCARD', KEYS[1]) < count then
  return {}
end

local popped = redis.call('ZPOPMIN', KEYS[1], count)
local result = {}

for i = 1, #popped, 2 do
  local uid = popped[i]
  local val = redis.call('GET', prefix .. uid)
  redis.call('DEL', prefix .. uid)
  table.insert(result, uid)
  table.insert(result, val or '')
end

return result
`;

interface StoredEntry {
  userId: string;
  queuedAt: string; // ISO 8601
  metadata: Record<string, unknown>;
}

function playerKey(userId: string): string {
  return `${PLAYER_PREFIX}${userId}`;
}

export class MatchmakingRepository {
  constructor(
    private readonly redis: Redis,
    private readonly pg: Pool
  ) {}

  // Atomically enqueues a player only if they are not already in the queue.
  // Returns true when the player was added, false when their key already existed
  // (they were already queued).  The ENQUEUE_NX_SCRIPT Lua closes the TOCTOU
  // window that existed between the old GET-then-MULTI/EXEC pattern.
  async enqueue(entry: QueueEntry): Promise<boolean> {
    const stored: StoredEntry = {
      userId: entry.userId,
      queuedAt: entry.queuedAt.toISOString(),
      metadata: entry.metadata,
    };
    const result = await this.redis.eval(
      ENQUEUE_NX_SCRIPT,
      2,
      QUEUE_KEY,
      playerKey(entry.userId),
      entry.userId,
      String(entry.queuedAt.getTime()),
      JSON.stringify(stored),
      String(PLAYER_TTL_S)
    );
    return result === 1;
  }

  // Atomically removes the player from both the sorted set and the metadata key.
  // Returns true when the player was actually present and removed, false when
  // they were not in the queue.  Using the ZREM return value as the source of
  // truth avoids the GET-then-MULTI/EXEC TOCTOU window in leaveQueue.
  async dequeue(userId: string): Promise<boolean> {
    const results = await this.redis
      .multi()
      .zrem(QUEUE_KEY, userId)
      .del(playerKey(userId))
      .exec();
    const zremCount = (results?.[0]?.[1] as number) ?? 0;
    return zremCount > 0;
  }

  async getQueueEntry(userId: string): Promise<QueueEntry | null> {
    const raw = await this.redis.get(playerKey(userId));
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredEntry;
    return {
      userId: stored.userId,
      queuedAt: new Date(stored.queuedAt),
      metadata: stored.metadata,
    };
  }

  // Atomically pops exactly `count` players from the queue using a Lua script.
  //
  // Guarantees:
  //   - Returns [] if queue size < count (no players are removed from the queue)
  //   - Returns exactly `count` entries otherwise (never a partial result)
  //   - Partial pops are impossible → the caller never needs to re-enqueue
  async popPlayers(count: number): Promise<QueueEntry[]> {
    const raw = (await this.redis.eval(
      POP_MATCH_SCRIPT,
      1,
      QUEUE_KEY,
      String(count),
      PLAYER_PREFIX
    )) as string[] | null;

    if (!raw || raw.length === 0) return [];

    const entries: QueueEntry[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const uid = raw[i];
      const metaJson = raw[i + 1]; // '' when player key had expired (TTL)
      if (metaJson) {
        const stored = JSON.parse(metaJson) as StoredEntry;
        entries.push({ userId: uid, queuedAt: new Date(stored.queuedAt), metadata: stored.metadata });
      } else {
        // Player key expired (TTL) but was still in the sorted set — rebuild minimal entry.
        entries.push({ userId: uid, queuedAt: new Date(), metadata: {} });
      }
    }
    return entries;
  }

  async saveMatch(playerIds: string[]): Promise<Match> {
    const id = randomUUID();
    const client = await this.pg.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO matches (id, status) VALUES ($1, $2)', [id, 'matched']);
      for (const userId of playerIds) {
        await client.query(
          'INSERT INTO match_players (match_id, user_id) VALUES ($1, $2)',
          [id, userId]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return { id, players: playerIds, status: 'matched', createdAt: new Date() };
  }
}
