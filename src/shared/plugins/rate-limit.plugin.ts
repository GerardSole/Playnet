import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { env } from '../../config/env';

// Redis key schema managed by @fastify/rate-limit's built-in RedisStore:
//
//   Global limit   →  rl:{clientIp}
//   Per-route limit →  rl:{METHOD}{routeUrl}-{clientIp}
//
// The RedisStore uses a single atomic Lua script (INCR + PEXPIRE/PTTL) so
// there are no race conditions even under high concurrent load across multiple
// instances — the increment and TTL management are a single indivisible
// operation on the Redis server.
//
// skipOnError: true — fail-open strategy.
// If Redis is temporarily unavailable, requests are allowed through rather
// than blocking the entire API.  A brief period of unthrottled traffic is
// acceptable for a game backend; a hard dependency on Redis for every request
// is not.  Monitor `redisSub.status` (health check) to detect Redis issues.
const RATE_LIMIT_KEY_NAMESPACE = 'rl:';

export const rateLimitPlugin = fp(
  async (app: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> => {
    await app.register(rateLimit, {
      max: env.RATE_LIMIT_MAX,
      timeWindow: env.RATE_LIMIT_WINDOW_MS,
      // Pass the shared Redis client — the plugin's built-in RedisStore
      // registers a rateLimit Lua command on it via defineCommand() and uses
      // INCR + PEXPIRE atomically.  All instances pointing to the same Redis
      // share a single counter per client IP / route combination.
      redis: app.redis,
      nameSpace: RATE_LIMIT_KEY_NAMESPACE,
      skipOnError: true,
      // @fastify/rate-limit throws the builder's return value. It must be an
      // Error so Fastify forwards it to setErrorHandler with the right status.
      errorResponseBuilder: (_request, context) => {
        const err = Object.assign(new Error(`Too many requests — retry after ${context.after}`), {
          statusCode: 429,
          code: 'RATE_LIMIT_EXCEEDED',
        });
        return err;
      },
    });
  }
);
