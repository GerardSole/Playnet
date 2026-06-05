import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { env } from '../../config/env';

export const helmetPlugin = fp(
  async (app: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> => {
    await app.register(helmet, {
      // Pure REST API — no browser UI served from this origin.
      // Keep headers that protect clients consuming the API.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // HSTS only meaningful over HTTPS — disable locally, enable in production
      hsts: env.NODE_ENV === 'production'
        ? { maxAge: 31_536_000, includeSubDomains: true }
        : false,
    });
  }
);
