import { z } from 'zod';

export const joinQueueBodySchema = z.object({
  metadata: z.record(z.string(), z.unknown()).optional(),
});
