import bcrypt from 'bcryptjs';
import { ConflictError, UnauthorizedError } from '../../shared/errors/AppError';
import {
  signAccessToken,
  ACCESS_TOKEN_TTL,
  generateRefreshToken,
  hashToken,
  refreshTokenExpiry,
} from './jwt';
import type { AuthRepository } from './repository';
import type { RegisteredUser, AuthResultInternal } from './types';
import type { RegisterDto, LoginDto, RefreshTokenDto } from './dto';
import { env } from '../../config/env';

const SALT_ROUNDS = 12;

// Precomputed at module load — ensures bcrypt.compare always runs even when
// no user is found, preventing email enumeration via response-time analysis.
const DUMMY_HASH = bcrypt.hashSync('playnet_timing_guard', SALT_ROUNDS);

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

  async register(dto: RegisterDto): Promise<RegisteredUser> {
    const taken = await this.authRepository.existsByEmailOrUsername(dto.email, dto.username);
    if (taken) {
      throw new ConflictError('Email or username already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    return this.authRepository.createUser({
      username: dto.username,
      email: dto.email,
      displayName: dto.displayName ?? dto.username,
      passwordHash,
    });
  }

  async login(dto: LoginDto): Promise<AuthResultInternal> {
    const user = await this.authRepository.findByEmail(dto.email);

    // Always run bcrypt.compare — constant time regardless of whether user exists.
    // Intentionally vague error: don't reveal which field is wrong.
    const hash = user?.passwordHash ?? DUMMY_HASH;
    const valid = await bcrypt.compare(dto.password, hash);

    if (!user || !valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const { raw, hash: tokenHash } = generateRefreshToken();

    // Enforce session limit: evict the least-recently-used session before
    // storing the new one so the total stays at or below MAX_SESSIONS_PER_USER.
    // The eviction and insert are atomic — no concurrent login can bypass the
    // limit by racing between the count check and the insert.
    await this.authRepository.storeRefreshTokenEnforceLimit(
      user.id,
      tokenHash,
      refreshTokenExpiry(),
      env.MAX_SESSIONS_PER_USER
    );

    return {
      userId: user.id,
      accessToken: signAccessToken(user.id),
      refreshToken: raw,
      expiresIn: ACCESS_TOKEN_TTL,
    };
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthResultInternal> {
    const tokenHash = hashToken(dto.refreshToken);
    const stored = await this.authRepository.findRefreshToken(tokenHash);

    if (!stored) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const { raw: newRaw, hash: newHash } = generateRefreshToken();

    // rotateRefreshToken now uses UPDATE instead of DELETE+INSERT.
    // If two concurrent /refresh calls arrive with the same token, only the
    // first UPDATE finds the old hash and succeeds; the second gets rowCount = 0.
    const rotated = await this.authRepository.rotateRefreshToken(
      tokenHash,
      stored.userId,
      newHash,
      refreshTokenExpiry()
    );

    if (!rotated) {
      // The token was found by findRefreshToken but the UPDATE missed it:
      // a concurrent /refresh call rotated it first.
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    return {
      userId: stored.userId,
      accessToken: signAccessToken(stored.userId),
      refreshToken: newRaw,
      expiresIn: ACCESS_TOKEN_TTL,
    };
  }

  async logout(dto: RefreshTokenDto): Promise<void> {
    const tokenHash = hashToken(dto.refreshToken);
    await this.authRepository.revokeRefreshToken(tokenHash);
    // Silently succeeds even if token was already revoked (idempotent)
  }
}
