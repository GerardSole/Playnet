import type { z } from 'zod';
import type { loginBodySchema, registerBodySchema, tokenBodySchema } from './schema';

// All DTOs derived from Zod schemas — single source of truth for shape and validation rules
export type RegisterDto = z.infer<typeof registerBodySchema>;
export type LoginDto = z.infer<typeof loginBodySchema>;
export type RefreshTokenDto = z.infer<typeof tokenBodySchema>;
