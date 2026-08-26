import { getCloudflareContext } from '@opennextjs/cloudflare';

type RateLimitBindingName =
  | 'JK_PRICING_PREVIEW_RATE_LIMIT'
  | 'JK_UPLOAD_INTENTS_RATE_LIMIT'
  | 'JK_UPLOAD_RATE_LIMIT';

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

declare global {
  interface CloudflareEnv {
    JK_PRICING_PREVIEW_RATE_LIMIT?: RateLimitBinding;
    JK_UPLOAD_INTENTS_RATE_LIMIT?: RateLimitBinding;
    JK_UPLOAD_RATE_LIMIT?: RateLimitBinding;
  }
}

export interface RateLimitSubject {
  userId?: string | null;
  guestSessionHash?: string | null;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * Applies a Worker-native, distributed rate limit. Production fails closed if
 * the binding is absent; local Next development remains usable without a
 * Cloudflare runtime and is covered by preview/deployment validation.
 */
export async function enforceCloudflareRateLimit(
  request: Request,
  bindingName: RateLimitBindingName,
  scope: string,
  subject: RateLimitSubject,
): Promise<RateLimitDecision> {
  const key = `${scope}:${await rateLimitIdentity(request, subject)}`;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const limiter = env[bindingName] as RateLimitBinding | undefined;
    if (!limiter) {
      return process.env.NODE_ENV === 'production'
        ? { allowed: false, retryAfterSeconds: 60 }
        : { allowed: true, retryAfterSeconds: 0 };
    }

    const { success } = await limiter.limit({ key });
    return { allowed: success, retryAfterSeconds: success ? 0 : 60 };
  } catch {
    return process.env.NODE_ENV === 'production'
      ? { allowed: false, retryAfterSeconds: 60 }
      : { allowed: true, retryAfterSeconds: 0 };
  }
}

async function rateLimitIdentity(request: Request, subject: RateLimitSubject): Promise<string> {
  if (subject.userId) return `user:${subject.userId}`;
  if (subject.guestSessionHash) return `guest:${subject.guestSessionHash}`;

  // Anonymous preview requests have no account/session yet. Hash the network
  // fallback so the limiter never receives a raw client address as its key.
  const network = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(network));
  return `network:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
