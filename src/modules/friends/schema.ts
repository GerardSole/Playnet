import { z } from 'zod';

export const sendRequestBodySchema = z.object({
  targetUserId: z.string().uuid('targetUserId must be a valid UUID'),
});

export const respondRequestBodySchema = z.object({
  requestId: z.string().uuid('requestId must be a valid UUID'),
});

export const friendIdParamsSchema = z.object({
  friendId: z.string().uuid('friendId must be a valid UUID'),
});
