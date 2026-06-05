import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../shared/middleware/auth.guard';
import { ValidationError } from '../../shared/errors/AppError';
import { zodToFastify } from '../../shared/utils/fastify-schema';
import { joinQueueBodySchema } from './schema';
import { MatchmakingRepository } from './repository';
import { MatchmakingService } from './service';
import { NotificationsRepository } from '../notifications/repository';
import { NotificationsService } from '../notifications/service';

// POST /api/v1/matchmaking/join   — enter the queue (creates match if 2+ players waiting)
// POST /api/v1/matchmaking/leave  — leave the queue
// GET  /api/v1/matchmaking/status — check own queue status
export const matchmakingController: FastifyPluginAsync = async (app) => {
  const repo = new MatchmakingRepository(app.redis, app.pg);
  const service = new MatchmakingService(repo);
  const notifService = new NotificationsService(new NotificationsRepository(app.pg));

  app.addHook('preHandler', authenticate);

  app.post(
    '/join',
    {
      schema: {
        summary: 'Join matchmaking queue',
        description: [
          'Adds the authenticated player to the matchmaking queue.',
          'If at least 2 players are waiting, a match is created immediately and returned in the response.',
          'All matched players receive a `match:created` WebSocket event and a `match.created` notification.',
        ].join(' '),
        body: zodToFastify(joinQueueBodySchema),
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  inQueue: { type: 'boolean', example: true },
                  queuedAt: { type: 'string', format: 'date-time' },
                  match: {
                    type: 'object',
                    nullable: true,
                    description: 'Present when a match was created immediately upon joining',
                    properties: {
                      matchId: { type: 'string', format: 'uuid' },
                      players: { type: 'array', items: { type: 'string', format: 'uuid' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.userId as string;
      const parsed = joinQueueBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        throw new ValidationError('Invalid request data', parsed.error.issues);
      }

      const { entry, match } = await service.joinQueue(userId, parsed.data);

      if (match) {
        for (const playerId of match.players) {
          app.io.to(`user:${playerId}`).emit('match:created', {
            matchId: match.id,
            players: match.players,
          });

          notifService
            .create(playerId, 'match.created', { matchId: match.id, players: match.players })
            .then((notif) => {
              app.io.to(`user:${playerId}`).emit('notification:new', {
                id: notif.id,
                type: notif.type,
                payload: notif.payload,
                read: notif.read,
                createdAt: notif.createdAt.toISOString(),
              });
            })
            .catch((err: unknown) => app.log.error({ err, playerId }, 'failed to create match.created notification'));
        }
      }

      return reply.send({
        data: {
          inQueue: true,
          queuedAt: entry.queuedAt,
          match: match ? { matchId: match.id, players: match.players } : null,
        },
      });
    }
  );

  app.post(
    '/leave',
    {
      schema: {
        summary: 'Leave matchmaking queue',
        description: 'Removes the authenticated player from the matchmaking queue. Returns 404 if the player is not currently queued.',
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'object', properties: { inQueue: { type: 'boolean', example: false } } },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.userId as string;
      await service.leaveQueue(userId);
      return reply.send({ data: { inQueue: false } });
    }
  );

  app.get(
    '/status',
    {
      schema: {
        summary: 'Get queue status',
        description: 'Returns whether the authenticated player is currently in the matchmaking queue.',
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  inQueue: { type: 'boolean', example: false },
                  queuedAt: { type: 'string', format: 'date-time', description: 'Present when inQueue is true' },
                  metadata: { type: 'object', description: 'Metadata provided at join time' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.userId as string;
      const status = await service.getStatus(userId);
      return reply.send({ data: status });
    }
  );
};
