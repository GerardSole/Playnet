import { z } from 'zod';

export const notificationsQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const markReadBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});
