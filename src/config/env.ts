import dotenv from 'dotenv';

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        `  → Copy .env.example to .env and fill in the value.`
    );
  }
  return value;
}

export const env = {
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
  PORT: parseInt(process.env['PORT'] ?? '3000', 10),
  HOST: process.env['HOST'] ?? '0.0.0.0',
  DATABASE_URL: required('DATABASE_URL'),
  REDIS_URL: required('REDIS_URL'),
  // Auth
  JWT_SECRET: required('JWT_SECRET'),
  JWT_ISSUER: process.env['JWT_ISSUER'] ?? 'playnet',
  JWT_AUDIENCE: process.env['JWT_AUDIENCE'] ?? 'playnet-api',
  JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN'] ?? '15m',
  REFRESH_TOKEN_EXPIRES_IN: process.env['REFRESH_TOKEN_EXPIRES_IN'] ?? '7d',
  // Rate limiting
  RATE_LIMIT_MAX: parseInt(process.env['RATE_LIMIT_MAX'] ?? '100', 10),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] ?? '60000', 10),
  AUTH_RATE_LIMIT_MAX: parseInt(process.env['AUTH_RATE_LIMIT_MAX'] ?? '10', 10),
  // Session management — maximum concurrent active sessions per user.
  // When a new login exceeds this limit the least-recently-used session is
  // evicted.  Adjust per deployment (e.g. lower for high-security services).
  MAX_SESSIONS_PER_USER: parseInt(process.env['MAX_SESSIONS_PER_USER'] ?? '5', 10),
  // Expired-token cleanup job — runs in the background on every instance but
  // only one instance executes the DELETE at a time (advisory lock).
  TOKEN_CLEANUP_INTERVAL_MS: parseInt(process.env['TOKEN_CLEANUP_INTERVAL_MS'] ?? '3600000', 10), // 1 h
  // Maximum rows deleted per cleanup run.  Caps transaction duration and
  // prevents table-lock contention on very large backlogs.
  TOKEN_CLEANUP_BATCH_SIZE: parseInt(process.env['TOKEN_CLEANUP_BATCH_SIZE'] ?? '1000', 10),
} as const;
