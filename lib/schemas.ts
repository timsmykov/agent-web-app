import { z } from 'zod';

export const messageSchema = z.object({
  id: z.string().min(1, 'message.id is required'),
  text: z.string().min(1, 'message.text must be a non-empty string'),
  role: z.literal('user'),
  ts: z.number().int()
});

const rawMetaSchema = z.object({
  client: z.string().min(1),
  sessionId: z.string().uuid().optional(),
  userAgent: z.string().min(1).optional(),
  lang: z.string().min(2).optional()
});

export const metaSchema = rawMetaSchema.transform((meta) => ({
  client: meta.client,
  sessionId: meta.sessionId ?? crypto.randomUUID(),
  userAgent: meta.userAgent ?? 'unknown',
  lang: meta.lang ?? 'ru'
}));

export const payloadSchema = z
  .object({
    message: messageSchema,
    meta: rawMetaSchema.default({ client: 'web' })
  })
  .transform((value) => ({
    message: value.message,
    meta: metaSchema.parse(value.meta)
  }));

export type MessagePayload = z.infer<typeof messageSchema>;
export type MetaPayload = z.infer<typeof metaSchema>;
export type DispatchPayload = z.infer<typeof payloadSchema>;
