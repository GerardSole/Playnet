import { z } from 'zod';

// POST /api/v1/users — internal user creation (admin use, bypasses auth registration flow)
export const createUserBodySchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be at most 50 characters'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address')
    .max(255),
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name must be at least 1 character')
    .max(100, 'Display name must be at most 100 characters'),
});

// GET /api/v1/users/:id
export const userIdParamsSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});
