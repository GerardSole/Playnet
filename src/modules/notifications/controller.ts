import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../shared/middleware/auth.guard';
import { ValidationError } from '../../shared/errors/AppError';
import { zodToFastify } from '../../shared/utils/fastify-schema';
import { notificationsQuerySchema, markReadBodySchema } from './schema';
import { NotificationsRepository } from './repository';
import { NotificationsService } from './service';

const notificationSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
    userId: { type: 'string', format: 'uuid' },
    type: {
      type: 'string',
      enum: ['friend.request', 'friend.accepted', 'match.created'],
      example: 'friend.request',
    },
    payload: {
      type: 'object',
      description: 'Event-specific data. Shape varies by `type`.',
      example: { requestId: 'uuid', fromUserId: 'uuid' },
    },
    read: { type: 'boolean', example: false },
    createdAt: { type: 'string', format: 'date-time' },
  },
} as const;

// GET  /api/v1/notifications            — list own notifications (paginated)
// POST /api/v1/notifications/read       — mark notifications as read
export const notificationsController: FastifyPluginAsync = async (app) => {
  const repo = new NotificationsRepository(app.pg);
  const service = new NotificationsService(repo);

  app.addHook('preHandler', authenticate);

  // GET /api/v1/notifications?unreadOnly=true&page=1&limit=20
  app.get(
    '/',
    {
      schema: {
        summary: 'List notifications',
        description: 'Returns the authenticated user\'s notifications, newest first. Use `unreadOnly=true` to filter to unread only.',
        querystring: zodToFastify(notificationsQuerySchema),
        response: {
          200: {
            type: 'object',
            properties: {
              data: { type: 'array', items: notificationSchema },
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
      const userId = request.userId as string;
      const parsed = notificationsQuerySchema.safeParse(request.query);
      if (!parsed.success) throw new ValidationError('Invalid query params', parsed.error.issues);

      const { notifications, total } = await service.list(userId, parsed.data);
      return reply.send({
        data: notifications,
        meta: { page: parsed.data.page, limit: parsed.data.limit, total },
      });
    }
  );

  // POST /api/v1/notifications/read
  app.post(
    '/read',
    {
      schema: {
        summary: 'Mark notifications as read',
        description: 'Marks the specified notifications as read. Only affects notifications that belong to the authenticated user.',
        body: zodToFastify(markReadBodySchema),
        response: {
          200: { type: 'object', properties: { data: { type: 'object', properties: { updated: { type: 'boolean' } } } } },
        },
      },
    },
    async (request, reply) => {
      const userId = request.userId as string;
      const parsed = markReadBodySchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError('Invalid request data', parsed.error.issues);

      await service.markRead(userId, parsed.data.ids);
      return reply.send({ data: { updated: true } });
    }
  );
};
