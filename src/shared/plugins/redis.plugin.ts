import fp from 'fastify-plugin';
import Redis from 'ioredis';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { env } from '../../config/env';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
    // Dedicated subscriber connection for the Socket.IO Redis Adapter.
    // A Redis connection in subscribe mode can only run pub/sub commands, so
    // this must be a separate connection from app.redis (which runs GET/SET/EVAL
    // etc. for application logic).  Created via redis.duplicate() so it shares
    // the same configuration (URL, TLS, retry policy) as the main connection.
    redisSub: Redis;
  }
}

const REDIS_OPTIONS = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  // Don't block startup if Redis is slow — fail fast instead
  connectTimeout: 5_000,
  lazyConnect: false,
} as const;

function attachListeners(redis: Redis, label: string, app: FastifyInstance): void {
  redis.on('error', (err: Error) => {
    app.log.error({ err }, `${label} error`);
  });
  redis.on('reconnecting', () => {
    app.log.warn(`${label} reconnecting...`);
  });
  redis.on('ready', () => {
    app.log.debug(`${label} ready`);
  });
}

export const redisPlugin = fp(
  async (app: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> => {
    const redis = new Redis(env.REDIS_URL, REDIS_OPTIONS);
    // duplicate() creates a fresh connection with the same options.
    // After the Socket.IO adapter subscribes to pub/sub channels on this
    // connection, ioredis enters subscribe mode and no regular commands
    // can be issued on it — that's intentional.
    const redisSub = redis.duplicate();

    attachListeners(redis, 'Redis', app);
    attachListeners(redisSub, 'Redis subscriber', app);

    try {
      await redis.ping();
      app.log.info('Redis connected');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Redis connection failed: ${message}`);
    }

    try {
      await redisSub.ping();
      app.log.info('Redis subscriber connected');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Redis subscriber connection failed: ${message}`);
    }

    app.decorate('redis', redis);
    app.decorate('redisSub', redisSub);

    // onClose hooks run LIFO — gatewayPlugin (registered after us) closes
    // Socket.IO first, then we close both Redis connections here.
    app.addHook('onClose', async () => {
      await Promise.all([redis.quit(), redisSub.quit()]);
      app.log.info('Redis connections closed');
    });
  }
);
