import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

// Extend FastifyRequest globally — picked up by all controllers automatically.
// Add `roles?: string[]` here when RBAC is introduced.
declare module 'fastify' {
  interface FastifyRequest {
    userId: string | null;
  }
}

export const authPlugin = fp(
  async (app: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> => {
    // Must be declared exactly once at root scope via fp() so all child scopes inherit it.
    // Default is null — set to the verified userId by the authenticate preHandler.
    app.decorateRequest('userId', null);
  }
);
