import type { FastifyPluginAsync } from 'fastify';
import { ValidationError } from '../../shared/errors/AppError';
import { authenticate } from '../../shared/middleware/auth.guard';
import { zodToFastify } from '../../shared/utils/fastify-schema';
import { updatePresenceBodySchema, presenceUserIdParamsSchema } from './schema';
import { RedisPresenceStore } from './redis-store';
import { PresenceService } from './service';

// socketId is intentionally absent — internal WebSocket field, never sent to clients
const presenceSchema = {
  type: 'object',
  properties: {
    userId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
    status: { type: 'string', enum: ['online', 'offline'], example: 'online' },
    lastSeen: { type: 'string', format: 'date-time' },
  },
} as const;

// PUT  /api/v1/presence         — set own presence status (authenticated)
// GET  /api/v1/presence         — list online users        (authenticated)
// GET  /api/v1/presence/:userId — get user's presence      (authenticated)
export const presenceController: FastifyPluginAsync = async (app) => {
  const store = new RedisPresenceStore(app.redis);
  const service = new PresenceService(store);

  app.addHook('preHandler', authenticate);

  // PUT /api/v1/presence
  app.put(
    '/',
    {
      schema: {
        summary: 'Set own presence status',
        description: 'Sets the authenticated user as online or offline. The WebSocket gateway also calls this automatically on connect/disconnect.',
        body: zodToFastify(updatePresenceBodySchema),
        response: { 200: { type: 'object', properties: { data: presenceSchema } } },
      },
    },
    async (request, reply) => {
      const userId = request.userId as string;
      const result = updatePresenceBodySchema.safeParse(request.body);
      if (!result.success) {
        throw new ValidationError('Invalid request data', result.error.issues);
      }

      const presence =
        result.data.status === 'online'
          ? await service.setOnline(userId)
          : await service.setOffline(userId);

      return reply.send({ data: presence });
    }
  );

  // GET /api/v1/presence
  app.get(
    '/',
    {
      schema: {
        summary: 'List online users',
        description: 'Returns all currently online players, ordered by most recently seen.',
        response: {
          200: {
            type: 'object',
            properties: { data: { type: 'array', items: presenceSchema } },
          },
        },
      },
    },
    async () => {
      const users = await service.getOnlineUsers();
      return { data: users };
    }
  );

  // GET /api/v1/presence/:userId
  app.get<{ Params: { userId: string } }>(
    '/:userId',
    {
      schema: {
        summary: 'Get user presence',
        description: 'Returns the presence status for a specific user. Returns `offline` with the current timestamp if no record exists.',
        params: zodToFastify(presenceUserIdParamsSchema),
        response: { 200: { type: 'object', properties: { data: presenceSchema } } },
      },
    },
    async (request) => {
      const result = presenceUserIdParamsSchema.safeParse(request.params);
      if (!result.success) {
        throw new ValidationError('Invalid request data', result.error.issues);
      }
      const presence = await service.getPresence(result.data.userId);
      return { data: presence };
    }
  );
};
