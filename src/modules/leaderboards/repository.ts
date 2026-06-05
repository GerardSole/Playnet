import type { Pool } from 'pg';
import { ConflictError } from '../../shared/errors/AppError';
import type { Leaderboard, LeaderboardEntry } from './types';

interface LeaderboardRow {
  id: string;
  name: string;
  created_at: Date;
}

// pg returns BIGINT columns as strings — always parse them explicitly
interface ScoreRow {
  user_id: string;
  score: string;
  updated_at: Date;
  rank: string;
}

function toLeaderboard(row: LeaderboardRow): Leaderboard {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

function toEntry(row: ScoreRow): LeaderboardEntry {
  return {
    userId: row.user_id,
    score: parseInt(row.score, 10),
    rank: parseInt(row.rank, 10),
    updatedAt: row.updated_at,
  };
}

export class LeaderboardsRepository {
  constructor(private readonly pg: Pool) {}

  async create(name: string): Promise<Leaderboard> {
    try {
      const result = await this.pg.query<LeaderboardRow>(
        'INSERT INTO leaderboards (name) VALUES ($1) RETURNING id, name, created_at',
        [name]
      );
      return toLeaderboard(result.rows[0]);
    } catch (err) {
      if (err instanceof Error && 'code' in err && err.code === '23505') {
        throw new ConflictError('Leaderboard name already exists');
      }
      throw err;
    }
  }

  async findById(id: string): Promise<Leaderboard | null> {
    const result = await this.pg.query<LeaderboardRow>(
      'SELECT id, name, created_at FROM leaderboards WHERE id = $1',
      [id]
    );
    return result.rows[0] ? toLeaderboard(result.rows[0]) : null;
  }

  // Upserts the score, keeping the best (highest) value.
  // updated_at only advances when the score actually improves.
  async submitScore(leaderboardId: string, userId: string, score: number): Promise<void> {
    await this.pg.query(
      `INSERT INTO leaderboard_scores (leaderboard_id, user_id, score)
       VALUES ($1, $2, $3)
       ON CONFLICT (leaderboard_id, user_id) DO UPDATE
         SET score      = GREATEST(leaderboard_scores.score, EXCLUDED.score),
             updated_at = CASE
               WHEN EXCLUDED.score > leaderboard_scores.score THEN NOW()
               ELSE leaderboard_scores.updated_at
             END`,
      [leaderboardId, userId, score]
    );
  }

  async getRankings(
    leaderboardId: string,
    page: number,
    limit: number
  ): Promise<{ entries: LeaderboardEntry[]; total: number }> {
    const offset = (page - 1) * limit;

    const [rankResult, countResult] = await Promise.all([
      this.pg.query<ScoreRow>(
        `SELECT user_id, score, updated_at, RANK() OVER (ORDER BY score DESC) AS rank
         FROM leaderboard_scores
         WHERE leaderboard_id = $1
         ORDER BY score DESC
         LIMIT $2 OFFSET $3`,
        [leaderboardId, limit, offset]
      ),
      this.pg.query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM leaderboard_scores WHERE leaderboard_id = $1',
        [leaderboardId]
      ),
    ]);

    return {
      entries: rankResult.rows.map(toEntry),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  async getPlayerRank(leaderboardId: string, userId: string): Promise<LeaderboardEntry | null> {
    const result = await this.pg.query<ScoreRow>(
      `SELECT user_id, score, updated_at, rank FROM (
         SELECT user_id, score, updated_at,
                RANK() OVER (ORDER BY score DESC) AS rank
         FROM leaderboard_scores
         WHERE leaderboard_id = $1
       ) ranked
       WHERE user_id = $2`,
      [leaderboardId, userId]
    );
    return result.rows[0] ? toEntry(result.rows[0]) : null;
  }
}
