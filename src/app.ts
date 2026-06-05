import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { loggerConfig } from './config/logger';
import { errorHandlerPlugin } from './shared/plugins/error-handler.plugin';
import { loggerPlugin } from './shared/plugins/logger.plugin';
import { helmetPlugin } from './shared/plugins/helmet.plugin';
import { rateLimitPlugin } from './shared/plugins/rate-limit.plugin';
import { databasePlugin } from './shared/plugins/database.plugin';
import { redisPlugin } from './shared/plugins/redis.plugin';
import { authPlugin } from './shared/plugins/auth.plugin';
import { gatewayPlugin } from './realtime/gateway.plugin';
import { swaggerPlugin } from './shared/plugins/swagger.plugin';
import { cleanupPlugin } from './shared/plugins/cleanup.plugin';
import { authController } from './modules/auth/controller';
import { usersController } from './modules/users/controller';
import { friendsController } from './modules/friends/controller';
import { presenceController } from './modules/presence/controller';
import { matchmakingController } from './modules/matchmaking/controller';
import { leaderboardsController } from './modules/leaderboards/controller';
import { notificationsController } from './modules/notifications/controller';
import { registerShutdown } from './shared/shutdown';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: loggerConfig,
    genReqId: () => randomUUID(),
    trustProxy: true,
    routerOptions: { ignoreTrailingSlash: true },
    // Allow OpenAPI keywords (example, description) inside AJV-validated schemas
    ajv: { customOptions: { strict: false } },
  });

  // ── Infrastructure plugins (order matters) ───────────────────────────────
  await app.register(errorHandlerPlugin); // must be first — sets error/404 handlers
  await app.register(helmetPlugin);       // HTTP security headers
  await app.register(loggerPlugin);       // onSend: injects requestId + X-Request-Id header
  await app.register(cors, { origin: env.NODE_ENV !== 'production' });
  await app.register(databasePlugin);
  await app.register(cleanupPlugin);      // expired-token cleanup job — needs app.pg
  await app.register(redisPlugin);        // must come before rateLimitPlugin and gatewayPlugin
  await app.register(rateLimitPlugin);    // global rate limiting — needs app.redis (Redis store)
  await app.register(authPlugin);         // decorates request.userId — must come before modules
  await app.register(gatewayPlugin);      // Socket.IO — needs app.pg and app.redis
  await app.register(swaggerPlugin);      // must be registered before routes to collect them

  // ── Health check ─────────────────────────────────────────────────────────
  app.get(
    '/health',
    {
      schema: {
        summary: 'Health check',
        description: 'Returns the health status of Postgres and Redis.',
        tags: ['System'],
        security: [],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              uptime: { type: 'number' },
              timestamp: { type: 'string' },
              version: { type: 'string' },
              services: {
                type: 'object',
                properties: {
                  postgres: { type: 'string' },
                  redis: { type: 'string' },
                  socketAdapter: { type: 'string', description: 'Redis Adapter subscriber connection for Socket.IO multi-instance sync' },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const [pgResult, redisResult] = await Promise.allSettled([
        app.pg.query('SELECT 1'),
        app.redis.ping(),
      ]);

      const postgres = pgResult.status === 'fulfilled' ? 'ok' : 'error';
      const redis = redisResult.status === 'fulfilled' ? 'ok' : 'error';
      // The subscriber connection is put in subscribe mode by the Redis Adapter
      // and cannot be pinged after startup.  Its ioredis status reflects the
      // underlying TCP connection state — 'ready' means the adapter can receive
      // cross-instance events.
      const socketAdapter = app.redisSub.status === 'ready' ? 'ok' : 'error';
      const status =
        postgres === 'ok' && redis === 'ok' && socketAdapter === 'ok'
          ? 'ok'
          : 'degraded';

      return reply.send({
        status,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        version: process.env['npm_package_version'] ?? '0.1.0',
        services: { postgres, redis, socketAdapter },
      });
    }
  );

  // ── API v1 ────────────────────────────────────────────────────────────────
  await app.register(
    async (api) => {
      await api.register(authController, { prefix: '/auth' });
      await api.register(usersController, { prefix: '/users' });
      await api.register(friendsController, { prefix: '/friends' });
      await api.register(presenceController, { prefix: '/presence' });
      await api.register(matchmakingController, { prefix: '/matchmaking' });
      await api.register(leaderboardsController, { prefix: '/leaderboards' });
      await api.register(notificationsController, { prefix: '/notifications' });
    },
    { prefix: '/api/v1' }
  );

  return app;
}

async function start(): Promise<void> {
  const app = await buildApp();
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    if (env.NODE_ENV !== 'test') registerShutdown(app);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
