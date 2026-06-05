import type { MatchmakingRepository } from './repository';
import type { Match, QueueEntry } from './types';
import type { JoinQueueDto } from './dto';
import { ConflictError, NotFoundError } from '../../shared/errors/AppError';

// Players required to form a match.
// Raise this constant (or make it configurable per queue type) to support larger lobbies.
const MATCH_SIZE = 2;

export interface QueueStatus {
  inQueue: boolean;
  queuedAt?: Date;
  metadata?: Record<string, unknown>;
}

export class MatchmakingService {
  constructor(private readonly repo: MatchmakingRepository) {}

  async joinQueue(
    userId: string,
    dto: JoinQueueDto
  ): Promise<{ entry: QueueEntry; match: Match | null }> {
    const entry: QueueEntry = {
      userId,
      queuedAt: new Date(),
      metadata: dto.metadata ?? {},
    };
    // enqueue() is atomic (Lua NX script): returns false when the player is
    // already in the queue, eliminating the TOCTOU window of a GET → check →
    // MULTI/EXEC sequence.
    const enqueued = await this.repo.enqueue(entry);
    if (!enqueued) throw new ConflictError('Already in matchmaking queue');

    const match = await this.tryMatch();
    return { entry, match };
  }

  async leaveQueue(userId: string): Promise<void> {
    // dequeue() returns whether the player was actually removed (ZREM count).
    // This replaces the GET → check → MULTI/EXEC pattern and closes the
    // concurrent-leave race window where two requests both passed the 404 guard.
    const removed = await this.repo.dequeue(userId);
    if (!removed) throw new NotFoundError('Matchmaking queue entry');
  }

  async getStatus(userId: string): Promise<QueueStatus> {
    const entry = await this.repo.getQueueEntry(userId);
    if (!entry) return { inQueue: false };
    return { inQueue: true, queuedAt: entry.queuedAt, metadata: entry.metadata };
  }

  // popPlayers() uses a Lua script that atomically checks queue size before
  // popping: it returns either an empty array (not enough players, no side
  // effects) or exactly MATCH_SIZE entries.  Partial results are impossible, so
  // no re-enqueue fallback is needed here.
  private async tryMatch(): Promise<Match | null> {
    const players = await this.repo.popPlayers(MATCH_SIZE);
    if (players.length < MATCH_SIZE) return null;
    return this.repo.saveMatch(players.map(p => p.userId));
  }
}
