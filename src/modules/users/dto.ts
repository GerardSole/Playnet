import type { z } from 'zod';
import type { createUserBodySchema, userIdParamsSchema } from './schema';

// Derived from Zod schemas — single source of truth for shape and validation.
export type CreateUserDto = z.infer<typeof createUserBodySchema>;
export type UserIdParams = z.infer<typeof userIdParamsSchema>;

export interface UpdateProfileDto {
  displayName?: string;
  avatarUrl?: string;
}
