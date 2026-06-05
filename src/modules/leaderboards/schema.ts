import { z } from 'zod';

export const createLeaderboardBodySchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export const submitScoreBodySchema = z.object({
  score: z.number().int().min(0),
});

export const leaderboardParamsSchema = z.object({
  leaderboardId: z.string().uuid(),
});

export const playerParamsSchema = z.object({
  leaderboardId: z.string().uuid(),
  playerId: z.string().uuid(),
});

export const rankingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
