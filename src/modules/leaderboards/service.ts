import type { LeaderboardsRepository } from './repository';
import type { Leaderboard, LeaderboardEntry } from './types';
import type { CreateLeaderboardDto, SubmitScoreDto } from './dto';
import { NotFoundError } from '../../shared/errors/AppError';

export class LeaderboardsService {
  constructor(private readonly repo: LeaderboardsRepository) {}

  async create(dto: CreateLeaderboardDto): Promise<Leaderboard> {
    return this.repo.create(dto.name);
  }

  // Submits a score and returns the player's updated rank so the caller
  // doesn't need a second request to see their position.
  async submitScore(
    leaderboardId: string,
    userId: string,
    dto: SubmitScoreDto
  ): Promise<LeaderboardEntry> {
    const lb = await this.repo.findById(leaderboardId);
    if (!lb) throw new NotFoundError('Leaderboard');

    await this.repo.submitScore(leaderboardId, userId, dto.score);

    // Cannot be null — we just upserted the row
    return (await this.repo.getPlayerRank(leaderboardId, userId))!;
  }

  async getRankings(
    leaderboardId: string,
    page: number,
    limit: number
  ): Promise<{ leaderboard: Leaderboard; entries: LeaderboardEntry[]; total: number }> {
    const lb = await this.repo.findById(leaderboardId);
    if (!lb) throw new NotFoundError('Leaderboard');

    const { entries, total } = await this.repo.getRankings(leaderboardId, page, limit);
    return { leaderboard: lb, entries, total };
  }

  async getPlayerRank(leaderboardId: string, playerId: string): Promise<LeaderboardEntry> {
    const lb = await this.repo.findById(leaderboardId);
    if (!lb) throw new NotFoundError('Leaderboard');

    const entry = await this.repo.getPlayerRank(leaderboardId, playerId);
    if (!entry) throw new NotFoundError('Player score');

    return entry;
  }
}
