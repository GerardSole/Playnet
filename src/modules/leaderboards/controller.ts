import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../shared/middleware/auth.guard';
import { ValidationError } from '../../shared/errors/AppError';
import { zodToFastify } from '../../shared/utils/fastify-schema';
import {
  createLeaderboardBodySchema,
  submitScoreBodySchema,
  leaderboardParamsSchema,
  playerParamsSchema,
  rankingsQuerySchema,
} from './schema';
import { LeaderboardsRepository } from './repository';
import { LeaderboardsService } from './service';

const leaderboardSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
    name: { type: 'string', example: 'Global Rankings' },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

const entrySchema = {
  type: 'object',
  properties: {
    userId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440001' },
    score: { type: 'number', example: 15000 },
    rank: { type: 'number', example: 1 },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

// POST /api/v1/leaderboards                               — create leaderboard
// POST /api/v1/leaderboards/:leaderboardId/submit         — submit score (own user)
// GET  /api/v1/leaderboards/:leaderboardId                — get rankings (paginated)
// GET  /api/v1/leaderboards/:leaderboardId/player/:playerId — get player rank
export const leaderboardsController: FastifyPluginAsync = async (app) => {
  const repo = new LeaderboardsRepository(app.pg);
  const service = new LeaderboardsService(repo);

  app.addHook('preHandler', authenticate);

  // POST /api/v1/leaderboards
  app.post(
    '/',
    {
      schema: {
        summary: 'Create leaderboard',
        description: 'Creates a new named leaderboard. The name must be unique.',
        body: zodToFastify(createLeaderboardBodySchema),
        response: {
          201: { type: 'object', properties: { data: leaderboardSchema } },
        },
      },
    },
    async (request, reply) => {
      const parsed = createLeaderboardBodySchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError('Invalid request data', parsed.error.issues);

      const leaderboard = await service.create(parsed.data);
      return reply.status(201).send({ data: leaderboard });
    }
  );

  // POST /api/v1/leaderboards/:leaderboardId/submit
  app.post<{ Params: { leaderboardId: string } }>(
    '/:leaderboardId/submit',
    {
      schema: {
        summary: 'Submit score',
        description: 'Submits the authenticated player\'s score. Only the **best (highest) score** is kept — submitting a lower score has no effect.',
        params: zodToFastify(leaderboardParamsSchema),
        body: zodToFastify(submitScoreBodySchema),
        response: {
          200: {
            type: 'object',
            description: 'Returns the player\'s updated rank immediately after submission',
            properties: { data: entrySchema },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.userId as string;

      const params = leaderboardParamsSchema.safeParse(request.params);
      if (!params.success) throw new ValidationError('Invalid leaderboard ID', params.error.issues);

      const body = submitScoreBodySchema.safeParse(request.body);
      if (!body.success) throw new ValidationError('Invalid request data', body.error.issues);

      const entry = await service.submitScore(params.data.leaderboardId, userId, body.data);
      return reply.send({ data: entry });
    }
  );

  // GET /api/v1/leaderboards/:leaderboardId
  app.get<{ Params: { leaderboardId: string }; Querystring: Record<string, string> }>(
    '/:leaderboardId',
    {
      schema: {
        summary: 'Get rankings',
        description: 'Returns paginated rankings for a leaderboard, ordered by score descending. Ties share the same rank.',
        params: zodToFastify(leaderboardParamsSchema),
        querystring: zodToFastify(rankingsQuerySchema),
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  leaderboard: leaderboardSchema,
                  entries: { type: 'array', items: entrySchema },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const params = leaderboardParamsSchema.safeParse(request.params);
      if (!params.success) throw new ValidationError('Invalid leaderboard ID', params.error.issues);

      const query = rankingsQuerySchema.safeParse(request.query);
      if (!query.success) throw new ValidationError('Invalid query params', query.error.issues);

      const { leaderboard, entries, total } = await service.getRankings(
        params.data.leaderboardId,
        query.data.page,
        query.data.limit
      );

      return reply.send({
        data: { leaderboard, entries },
        meta: { page: query.data.page, limit: query.data.limit, total },
      });
    }
  );

  // GET /api/v1/leaderboards/:leaderboardId/player/:playerId
  app.get<{ Params: { leaderboardId: string; playerId: string } }>(
    '/:leaderboardId/player/:playerId',
    {
      schema: {
        summary: 'Get player rank',
        description: 'Returns the rank and score for a specific player in a leaderboard. Returns 404 if the player has not submitted a score.',
        params: zodToFastify(playerParamsSchema),
        response: {
          200: { type: 'object', properties: { data: entrySchema } },
        },
      },
    },
    async (request, reply) => {
      const params = playerParamsSchema.safeParse(request.params);
      if (!params.success) throw new ValidationError('Invalid parameters', params.error.issues);

      const entry = await service.getPlayerRank(params.data.leaderboardId, params.data.playerId);
      return reply.send({ data: entry });
    }
  );
};
