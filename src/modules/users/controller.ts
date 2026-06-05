import type { FastifyPluginAsync } from 'fastify';
import { UnauthorizedError, ValidationError } from '../../shared/errors/AppError';
import { authenticate } from '../../shared/middleware/auth.guard';
import { zodToFastify } from '../../shared/utils/fastify-schema';
import { createUserBodySchema, userIdParamsSchema } from './schema';
import { UsersRepository } from './repository';
import { UsersService } from './service';

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
    username: { type: 'string', example: 'player_one' },
    email: { type: 'string', format: 'email', example: 'player@example.com' },
    displayName: { type: 'string', example: 'Player One' },
    avatarUrl: { type: 'string', nullable: true, example: null },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

// GET /api/v1/users/me
// GET /api/v1/users/:id
// POST /api/v1/users
export const usersController: FastifyPluginAsync = async (app) => {
  const repository = new UsersRepository(app.pg);
  const service = new UsersService(repository);

  // Protected — returns the authenticated user's own profile.
  app.get(
    '/me',
    {
      preHandler: [authenticate],
      schema: {
        summary: 'Get own profile',
        description: 'Returns the full profile of the currently authenticated user.',
        response: { 200: { type: 'object', properties: { data: userSchema } } },
      },
    },
    async (request) => {
      const userId = request.userId;
      if (!userId) throw new UnauthorizedError('Not authenticated');
      const user = await service.getUserById(userId);
      return { data: user };
    }
  );

  app.post(
    '/',
    {
      schema: {
        summary: 'Create user (internal)',
        description: 'Creates a user profile. Intended for internal/admin use — most clients should use `POST /auth/register`.',
        body: zodToFastify(createUserBodySchema),
        response: {
          201: {
            type: 'object',
            properties: { data: userSchema },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = createUserBodySchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError('Invalid request data', parsed.error.issues);

      const user = await service.createUser(parsed.data);
      return reply.status(201).send({ data: user });
    }
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      schema: {
        summary: 'Get user by ID',
        description: 'Returns the public profile for any user. Does not require authentication.',
        params: zodToFastify(userIdParamsSchema),
        response: {
          200: {
            type: 'object',
            properties: { data: userSchema },
          },
        },
      },
    },
    async (request) => {
      const parsed = userIdParamsSchema.safeParse(request.params);
      if (!parsed.success) throw new ValidationError('Invalid user ID', parsed.error.issues);

      const user = await service.getUserById(parsed.data.id);
      return { data: user };
    }
  );
};
