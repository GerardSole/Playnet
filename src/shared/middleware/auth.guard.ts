import type { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../errors/AppError';
import { verifyAccessToken } from '../../modules/auth/jwt';

/**
 * Fastify preHandler that verifies the Bearer JWT and attaches `request.userId`.
 *
 * Usage:
 *   app.get('/me', { preHandler: [authenticate] }, handler)
 *   app.register(scope, { preHandler: [authenticate] })   // protect entire scope
 *
 * Future roles: add `requireRole('admin')` after this in the preHandler array.
 * Throws UnauthorizedError on any failure — handled centrally by errorHandlerPlugin.
 */
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = header.slice(7);

  try {
    const payload = verifyAccessToken(token);
    request.userId = payload.sub;
  } catch {
    // jsonwebtoken throws JsonWebTokenError / TokenExpiredError on bad/expired tokens
    throw new UnauthorizedError('Invalid or expired access token');
  }
}
