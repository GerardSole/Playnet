import type { FastifyPluginAsync } from 'fastify';
import { ValidationError } from '../../shared/errors/AppError';
import { authenticate } from '../../shared/middleware/auth.guard';
import { zodToFastify } from '../../shared/utils/fastify-schema';
import { sendRequestBodySchema, respondRequestBodySchema, friendIdParamsSchema } from './schema';
import { FriendsRepository } from './repository';
import { FriendsService } from './service';
import { NotificationsRepository } from '../notifications/repository';
import { NotificationsService } from '../notifications/service';

const friendRequestSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
    senderId: { type: 'string', format: 'uuid' },
    receiverId: { type: 'string', format: 'uuid' },
    status: { type: 'string', enum: ['pending', 'accepted', 'rejected'], example: 'pending' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const friendProfileSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
    username: { type: 'string', example: 'player_two' },
    displayName: { type: 'string', example: 'Player Two' },
    avatarUrl: { type: 'string', nullable: true, example: null },
  },
} as const;

// POST /api/v1/friends/request
// POST /api/v1/friends/accept
// POST /api/v1/friends/reject
// GET  /api/v1/friends
// DELETE /api/v1/friends/:friendId
export const friendsController: FastifyPluginAsync = async (app) => {
  const repository = new FriendsRepository(app.pg);
  const service = new FriendsService(repository);
  const notifService = new NotificationsService(new NotificationsRepository(app.pg));

  // All routes in this module require authentication
  app.addHook('preHandler', authenticate);

  // POST /api/v1/friends/request
  app.post(
    '/request',
    {
      schema: {
        summary: 'Send friend request',
        description: 'Sends a friend request to another user. Triggers a `friend.request` notification for the receiver.',
        body: zodToFastify(sendRequestBodySchema),
        response: { 201: { type: 'object', properties: { data: friendRequestSchema } } },
      },
    },
    async (request, reply) => {
      const userId = request.userId as string;
      const result = sendRequestBodySchema.safeParse(request.body);
      if (!result.success) {
        throw new ValidationError('Invalid request data', result.error.issues);
      }
      const friendRequest = await service.sendRequest(userId, result.data);

      notifService
        .create(friendRequest.receiverId, 'friend.request', {
          requestId: friendRequest.id,
          fromUserId: userId,
        })
        .then((notif) => {
          app.io.to(`user:${friendRequest.receiverId}`).emit('notification:new', {
            id: notif.id,
            type: notif.type,
            payload: notif.payload,
            read: notif.read,
            createdAt: notif.createdAt.toISOString(),
          });
        })
        .catch((err: unknown) => app.log.error({ err }, 'failed to create friend.request notification'));

      return reply.status(201).send({ data: friendRequest });
    }
  );

  // POST /api/v1/friends/accept
  app.post(
    '/accept',
    {
      schema: {
        summary: 'Accept friend request',
        description: 'Accepts a pending friend request addressed to the authenticated user. Triggers a `friend.accepted` notification for the original sender.',
        body: zodToFastify(respondRequestBodySchema),
        response: { 200: { type: 'object', properties: { data: friendRequestSchema } } },
      },
    },
    async (request, reply) => {
      const userId = request.userId as string;
      const result = respondRequestBodySchema.safeParse(request.body);
      if (!result.success) {
        throw new ValidationError('Invalid request data', result.error.issues);
      }
      const friendRequest = await service.acceptRequest(userId, result.data);

      notifService
        .create(friendRequest.senderId, 'friend.accepted', {
          requestId: friendRequest.id,
          byUserId: userId,
        })
        .then((notif) => {
          app.io.to(`user:${friendRequest.senderId}`).emit('notification:new', {
            id: notif.id,
            type: notif.type,
            payload: notif.payload,
            read: notif.read,
            createdAt: notif.createdAt.toISOString(),
          });
        })
        .catch((err: unknown) => app.log.error({ err }, 'failed to create friend.accepted notification'));

      return reply.send({ data: friendRequest });
    }
  );

  // POST /api/v1/friends/reject
  app.post(
    '/reject',
    {
      schema: {
        summary: 'Reject friend request',
        description: 'Rejects a pending friend request addressed to the authenticated user.',
        body: zodToFastify(respondRequestBodySchema),
        response: { 200: { type: 'object', properties: { data: friendRequestSchema } } },
      },
    },
    async (request, reply) => {
      const userId = request.userId as string;
      const result = respondRequestBodySchema.safeParse(request.body);
      if (!result.success) {
        throw new ValidationError('Invalid request data', result.error.issues);
      }
      const friendRequest = await service.rejectRequest(userId, result.data);
      return reply.send({ data: friendRequest });
    }
  );

  // GET /api/v1/friends
  app.get(
    '/',
    {
      schema: {
        summary: 'List friends',
        description: 'Returns the list of accepted friends for the authenticated user.',
        response: {
          200: { type: 'object', properties: { data: { type: 'array', items: friendProfileSchema } } },
        },
      },
    },
    async (request) => {
      const userId = request.userId as string;
      const friends = await service.listFriends(userId);
      return { data: friends };
    }
  );

  // DELETE /api/v1/friends/:friendId
  app.delete(
    '/:friendId',
    {
      schema: {
        summary: 'Remove friend',
        description: 'Removes the friendship between the authenticated user and the specified user.',
        params: zodToFastify(friendIdParamsSchema),
        response: { 204: { type: 'null' } },
      },
    },
    async (request, reply) => {
      const userId = request.userId as string;
      const params = friendIdParamsSchema.safeParse(request.params);
      if (!params.success) {
        throw new ValidationError('Invalid request data', params.error.issues);
      }
      await service.removeFriend(userId, params.data.friendId);
      return reply.status(204).send();
    }
  );
};
