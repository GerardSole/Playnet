import type { z } from 'zod';
import type { sendRequestBodySchema, respondRequestBodySchema, friendIdParamsSchema } from './schema';

export type SendRequestDto = z.infer<typeof sendRequestBodySchema>;
export type RespondRequestDto = z.infer<typeof respondRequestBodySchema>;
export type FriendIdParams = z.infer<typeof friendIdParamsSchema>;
