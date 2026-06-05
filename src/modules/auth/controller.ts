import type { FastifyPluginAsync } from 'fastify';
import { UnauthorizedError, ValidationError } from '../../shared/errors/AppError';
import { zodToFastify } from '../../shared/utils/fastify-schema';
import { registerBodySchema, loginBodySchema, tokenBodySchema } from './schema';
import { AuthRepository } from './repository';
import { AuthService } from './service';
import { env } from '../../config/env';

const registeredUserSchema = {
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

// userId is intentionally absent — service returns AuthResultInternal but the
// response schema strips it so clients never receive the userId field.
const authResponseSchema = {
  type: 'object',
  properties: {
    accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
    refreshToken: { type: 'string', example: 'a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5...' },
    expiresIn: { type: 'number', example: 900 },
  },
} as const;

const AUTH_RATE_LIMIT = {
  max: env.AUTH_RATE_LIMIT_MAX,
  timeWindow: env.RATE_LIMIT_WINDOW_MS,
} as const;

export const authController: FastifyPluginAsync = async (app) => {
  const repository = new AuthRepository(app.pg);
  const service = new AuthService(repository);

  // POST /api/v1/auth/register
  app.post(
    '/register',
    {
      config: { rateLimit: AUTH_RATE_LIMIT },
      schema: {
        summary: 'Register a new account',
        description: 'Creates a new player account. Username must be unique and match `^[a-z0-9_]+$`.',
        body: zodToFastify(registerBodySchema),
        response: { 201: { type: 'object', properties: { data: registeredUserSchema } } },
      },
    },
    async (request, reply) => {
      const result = registerBodySchema.safeParse(request.body);
      if (!result.success) {
        throw new ValidationError('Invalid request data', result.error.issues);
      }
      const user = await service.register(result.data);
      request.log.info({ event: 'auth.register', userId: user.id }, 'user registered');
      return reply.status(201).send({ data: user });
    }
  );

  // POST /api/v1/auth/login
  app.post(
    '/login',
    {
      config: { rateLimit: AUTH_RATE_LIMIT },
      schema: {
        summary: 'Login',
        description: 'Authenticates a player and returns an access token + refresh token pair.',
        body: zodToFastify(loginBodySchema),
        response: { 200: authResponseSchema },
      },
    },
    async (request, reply) => {
      const result = loginBodySchema.safeParse(request.body);
      if (!result.success) {
        throw new ValidationError('Invalid request data', result.error.issues);
      }

      try {
        const authResult = await service.login(result.data);
        request.log.info(
          { event: 'auth.login.success', userId: authResult.userId },
          'login successful'
        );
        return reply.send(authResult); // schema strips userId before sending
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          request.log.warn(
            { event: 'auth.login.failure', email: result.data.email, ip: request.ip },
            'login failed'
          );
        }
        throw err;
      }
    }
  );

  // POST /api/v1/auth/refresh
  app.post(
    '/refresh',
    {
      config: { rateLimit: AUTH_RATE_LIMIT },
      schema: {
        summary: 'Refresh access token',
        description: 'Issues a new access token + refresh token pair. The old refresh token is invalidated.',
        body: zodToFastify(tokenBodySchema),
        response: { 200: authResponseSchema },
      },
    },
    async (request, reply) => {
      const result = tokenBodySchema.safeParse(request.body);
      if (!result.success) {
        throw new ValidationError('Invalid request data', result.error.issues);
      }

      const authResult = await service.refresh(result.data);
      request.log.info(
        { event: 'auth.refresh', userId: authResult.userId },
        'token refreshed'
      );
      return reply.send(authResult); // schema strips userId before sending
    }
  );

  // POST /api/v1/auth/logout
  app.post(
    '/logout',
    {
      config: { rateLimit: AUTH_RATE_LIMIT },
      schema: {
        summary: 'Logout',
        description: 'Revokes the provided refresh token. The access token is not invalidated server-side — let it expire naturally.',
        body: zodToFastify(tokenBodySchema),
        response: { 204: { type: 'null' } },
      },
    },
    async (request, reply) => {
      const result = tokenBodySchema.safeParse(request.body);
      if (!result.success) {
        throw new ValidationError('Invalid request data', result.error.issues);
      }
      await service.logout(result.data);
      request.log.info({ event: 'auth.logout' }, 'logout');
      return reply.status(204).send();
    }
  );
};
