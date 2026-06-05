import { z } from 'zod';

export const updatePresenceBodySchema = z.object({
  status: z.enum(['online', 'offline']),
});

export const presenceUserIdParamsSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
});
