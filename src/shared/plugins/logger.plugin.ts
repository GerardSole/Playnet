import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

export const loggerPlugin = fp(
  async (app: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> => {
    app.addHook('onSend', async (request, reply, payload) => {
      // Every response carries X-Request-Id so clients can correlate logs
      reply.header('X-Request-Id', request.id);

      // Inject requestId into JSON bodies that don't already have it.
      // Error responses set it explicitly; this covers all success responses.
      if (typeof payload !== 'string') return payload;

      let body: unknown;
      try {
        body = JSON.parse(payload);
      } catch {
        return payload; // non-JSON (e.g. plain text) — pass through unchanged
      }

      if (
        typeof body === 'object' &&
        body !== null &&
        !Array.isArray(body) &&
        !('requestId' in body)
      ) {
        (body as Record<string, unknown>).requestId = request.id;
        return JSON.stringify(body);
      }

      return payload;
    });
  }
);
