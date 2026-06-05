import type { FastifyServerOptions } from 'fastify';
import { env } from './env';

type ErrResult = { type: string; message: string; stack: string; [key: string]: unknown };

function serializeErr(err: unknown): ErrResult {
  if (!(err instanceof Error)) {
    return { type: 'UnknownError', message: String(err), stack: '' };
  }
  const result: ErrResult = {
    type: err.constructor.name,
    message: err.message,
    stack: env.NODE_ENV !== 'production' ? (err.stack ?? '') : '',
  };
  if ('code' in err) result.code = (err as { code: unknown }).code;
  if ('statusCode' in err) result.statusCode = (err as { statusCode: unknown }).statusCode;
  return result;
}

export const loggerConfig: FastifyServerOptions['logger'] = {
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',

  // Prevent auth tokens and cookies from appearing in logs
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    censor: '[REDACTED]',
  },

  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        hostname: req.hostname,
        remoteAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
    // Default pino serializer drops custom AppError fields (code, statusCode).
    // This version preserves them for better log context.
    err: serializeErr,
  },
};
