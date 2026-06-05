import { randomBytes, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import type { JwtPayload } from './types';

// ─── Duration helpers ─────────────────────────────────────────────────────────

function durationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid duration format: "${duration}"`);
  const value = parseInt(match[1], 10);
  const ms: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * ms[match[2]];
}

// ─── Access token ─────────────────────────────────────────────────────────────

export const ACCESS_TOKEN_TTL = durationToMs(env.JWT_EXPIRES_IN) / 1_000; // seconds

// Explicit algorithm prevents algorithm-confusion attacks (e.g. RS256 → HS256 swap).
// Issuer + audience claims prevent tokens from one service being accepted by another.
const JWT_SIGN_OPTIONS: jwt.SignOptions = {
  algorithm: 'HS256',
  expiresIn: ACCESS_TOKEN_TTL,
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
};

const JWT_VERIFY_OPTIONS: jwt.VerifyOptions = {
  algorithms: ['HS256'],
  issuer: env.JWT_ISSUER,
  audience: env.JWT_AUDIENCE,
};

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, JWT_SIGN_OPTIONS) as string;
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, JWT_VERIFY_OPTIONS);
  if (typeof decoded !== 'object' || !decoded) {
    throw new Error('Invalid token payload');
  }
  return decoded as JwtPayload;
}

// ─── Refresh token ────────────────────────────────────────────────────────────

// 128-char hex string (64 random bytes) — opaque, stored as SHA-256 hash in DB
export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = randomBytes(64).toString('hex');
  const hash = createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

// Use to look up a token received from the client
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + durationToMs(env.REFRESH_TOKEN_EXPIRES_IN));
}
