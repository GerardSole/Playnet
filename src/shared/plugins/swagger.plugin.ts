import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance, FastifySchema } from 'fastify';

// Routes that do not require a Bearer token
const PUBLIC_ROUTES = new Set([
  '/health',
  '/api/v1/auth/register',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/users',
  '/api/v1/users/:id',
]);

// Inline schema for error responses — shared by every route via transform
const ERROR_RESPONSE = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        statusCode: { type: 'integer', example: 400 },
        code: { type: 'string', example: 'VALIDATION_ERROR' },
        message: { type: 'string', example: 'Invalid request data' },
        details: { description: 'Validation issue details (optional)' },
      },
    },
    requestId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
  },
};

function tagFromUrl(url: string): string {
  if (url === '/health') return 'System';
  const segment = url.split('/')[3] ?? '';
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export const swaggerPlugin = fp(async (app: FastifyInstance): Promise<void> => {
  // Register for AJV — routes can $ref this schema in response validation
  app.addSchema({ $id: 'ErrorResponse', ...ERROR_RESPONSE });

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Playnet API',
        description: [
          '## Overview',
          'Game backend platform — authentication, realtime presence, matchmaking, leaderboards, and notifications.',
          '',
          '## Authentication',
          'Protected endpoints require a Bearer JWT obtained from `POST /auth/login`:',
          '```',
          'Authorization: Bearer <accessToken>',
          '```',
          'Access tokens expire in **15 minutes**. Rotate with `POST /auth/refresh`.',
          '',
          '## Error format',
          'All error responses share this envelope:',
          '```json',
          '{ "error": { "statusCode": 400, "code": "VALIDATION_ERROR", "message": "..." }, "requestId": "uuid" }',
          '```',
          '',
          '## WebSocket',
          'Connect via Socket.IO at `ws://{host}` with `auth: { token: "<accessToken>" }`.',
          'Server → client events: `match:created`, `notification:new`.',
        ].join('\n'),
        version: '0.1.0',
      },
      servers: [{ url: '/api/v1', description: 'API v1' }],
      tags: [
        { name: 'Auth', description: 'Registration, login, and token lifecycle' },
        { name: 'Users', description: 'User profiles' },
        { name: 'Friends', description: 'Friend requests and friendships' },
        { name: 'Presence', description: 'Online / offline status' },
        { name: 'Matchmaking', description: 'Player queue and automatic match creation' },
        { name: 'Leaderboards', description: 'Score submission and global rankings' },
        { name: 'Notifications', description: 'In-app notification feed' },
        { name: 'System', description: 'Infrastructure endpoints' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: 'http' as any,
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Access token from `POST /auth/login`',
          },
        },
      },
    },

    // transform runs only for OpenAPI spec generation — does NOT affect route validation
    transform({ schema, url }: { schema: FastifySchema; url: string }) {
      const isPublic = PUBLIC_ROUTES.has(url);
      const tag = tagFromUrl(url);
      const s = schema as Record<string, unknown>;

      const errorResponses: Record<string, unknown> = { 400: ERROR_RESPONSE, 500: ERROR_RESPONSE };
      if (!isPublic) {
        errorResponses[401] = ERROR_RESPONSE;
        errorResponses[403] = ERROR_RESPONSE;
      }

      return {
        schema: {
          ...s,
          tags: (s['tags'] as string[] | undefined) ?? (tag ? [tag] : undefined),
          security: (s['security'] as unknown[]) ?? (isPublic ? [] : [{ bearerAuth: [] }]),
          response: { ...errorResponses, ...((s['response'] as Record<string, unknown>) ?? {}) },
        } as FastifySchema,
        url,
      };
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
    staticCSP: true,
  });
});
