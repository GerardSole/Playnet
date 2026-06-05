import { z } from 'zod';

// In Zod, .trim() and .toLowerCase() run during parsing (before validators like .email()).
// .transform() runs after all validators — used only when no native method exists.
export const registerBodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters')
    .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address')
    .max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password must be at most 100 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  displayName: z.string().trim().min(1).max(100).optional(),
});

// Login: no format constraints on password — avoid locking out users whose
// passwords predate the complexity rules. Email is normalized for lookup.
export const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address').max(255),
  password: z.string().min(1, 'Password is required').max(100),
});

// Shared by /refresh and /logout.
// Validate exact token format: 128 hex chars (64 random bytes).
export const tokenBodySchema = z.object({
  refreshToken: z
    .string()
    .length(128, 'Invalid refresh token format')
    .regex(/^[0-9a-f]+$/, 'Invalid refresh token format'),
});
