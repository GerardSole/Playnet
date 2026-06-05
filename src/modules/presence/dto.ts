import type { z } from 'zod';
import type { updatePresenceBodySchema, presenceUserIdParamsSchema } from './schema';

export type UpdatePresenceDto = z.infer<typeof updatePresenceBodySchema>;
export type PresenceUserIdParams = z.infer<typeof presenceUserIdParamsSchema>;
