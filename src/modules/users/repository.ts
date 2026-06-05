import type { Pool } from 'pg';
import { ConflictError } from '../../shared/errors/AppError';
import type { User } from './types';
import type { CreateUserDto } from './dto';

// All queries return camelCase column names via SQL aliases — no mapping layer needed.
const SELECT_COLS = `
  id,
  username,
  email,
  display_name  AS "displayName",
  avatar_url    AS "avatarUrl",
  created_at    AS "createdAt",
  updated_at    AS "updatedAt"
`;

function isPgError(err: unknown): err is { code: string; constraint?: string } {
  return err instanceof Error && 'code' in err;
}

export class UsersRepository {
  constructor(private readonly db: Pool) {}

  async create(dto: CreateUserDto): Promise<User> {
    try {
      const { rows } = await this.db.query<User>(
        `INSERT INTO users (username, email, display_name)
         VALUES ($1, $2, $3)
         RETURNING ${SELECT_COLS}`,
        [dto.username, dto.email, dto.displayName]
      );
      return rows[0];
    } catch (err) {
      // 23505 = unique_violation — email or username already taken
      if (isPgError(err) && err.code === '23505') {
        throw new ConflictError('Email or username already in use');
      }
      throw err;
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const { rows } = await this.db.query<User>(
        `SELECT ${SELECT_COLS} FROM users WHERE id = $1`,
        [id]
      );
      return rows[0] ?? null;
    } catch (err) {
      // 22P02 = invalid_text_representation (e.g. malformed UUID) — treat as not found
      if (isPgError(err) && err.code === '22P02') {
        return null;
      }
      throw err;
    }
  }

  async existsByEmailOrUsername(email: string, username: string): Promise<boolean> {
    const { rows } = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1 OR username = $2) AS exists`,
      [email, username]
    );
    return rows[0].exists;
  }
}
