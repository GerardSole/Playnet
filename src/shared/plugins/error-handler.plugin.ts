import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginOptions, FastifyError } from 'fastify';
import { AppError } from '../errors/AppError';

export const errorHandlerPlugin = fp(
  async (app: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> => {
    // 404 — not logged (too noisy; shows up in access log automatically)
    app.setNotFoundHandler((request, reply) => {
      void reply.status(404).send({
        error: {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: `Route ${request.method} ${request.url} not found`,
        },
        requestId: request.id,
      });
    });

    app.setErrorHandler((error: FastifyError, request, reply) => {
      // Known domain errors (ConflictError, NotFoundError, ValidationError…) — warn level
      if (error instanceof AppError) {
        request.log.warn({ err: error, statusCode: error.statusCode }, 'application error');
        return reply.status(error.statusCode).send({
          error: {
            statusCode: error.statusCode,
            code: error.code,
            message: error.message,
            // Include details when present (e.g. Zod field errors, validation context)
            ...(error.details !== undefined && { details: error.details }),
          },
          requestId: request.id,
        });
      }

      // Fastify JSON-Schema validation errors — info level (client mistake, not a bug)
      // Must come before the statusCode check: validation errors also have statusCode=400.
      if (error.validation) {
        request.log.info({ validationErrors: error.validation }, 'validation error');
        return reply.status(400).send({
          error: {
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.validation,
          },
          requestId: request.id,
        });
      }

      // Fastify plugin errors (e.g. rate-limit exceeded) — thrown Error with a
      // statusCode property that is not an AppError and not a validation error.
      if (typeof error.statusCode === 'number' && error.statusCode < 500) {
        request.log.warn({ err: error, statusCode: error.statusCode }, 'plugin error');
        return reply.status(error.statusCode).send({
          error: {
            statusCode: error.statusCode,
            code: (error as FastifyError & { code?: string }).code ?? 'PLUGIN_ERROR',
            message: error.message,
          },
          requestId: request.id,
        });
      }

      // Unexpected errors — error level, full stack
      request.log.error({ err: error }, 'unhandled error');
      return reply.status(500).send({
        error: {
          statusCode: 500,
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        requestId: request.id,
      });
    });
  }
);
