import { z } from 'zod';
import { isAllowedPushEndpoint } from './web-push';

const base64Url = /^[A-Za-z0-9_-]+$/;

/** Formato de PushSubscription.toJSON() enviado pelo navegador. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().trim().min(20).max(1000).refine(isAllowedPushEndpoint, 'Serviço de push não suportado.'),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(80).max(100).regex(base64Url),
    auth: z.string().min(16).max(32).regex(base64Url),
  }).strict(),
}).strict();

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
