import crypto from 'crypto';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Arquivos de pedido ficam num bucket R2 privado (binding ORDER_FILES).
// A regra de ciclo de vida do bucket apaga tudo em `private/` após 15 dias,
// então a retenção física não depende deste código.

interface R2ObjectBodyLike {
  body: ReadableStream;
  size: number;
}

interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBodyLike | null>;
  delete(keys: string | string[]): Promise<void>;
}

const STORAGE_PATH_PATTERN = /^private\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.bin$/;
const TOKEN_VERSION = 'v1';

async function orderFilesBucket(): Promise<R2BucketLike> {
  const { env } = await getCloudflareContext({ async: true });
  const bucket = (env as unknown as Record<string, unknown>).ORDER_FILES as R2BucketLike | undefined;
  if (!bucket) throw new Error('ORDER_FILES_BUCKET_UNAVAILABLE');
  return bucket;
}

export function isOrderFileStoragePath(path: string): boolean {
  return STORAGE_PATH_PATTERN.test(path);
}

export async function putOrderFile(path: string, data: Uint8Array, contentType: string): Promise<void> {
  if (!isOrderFileStoragePath(path)) throw new Error('INVALID_STORAGE_PATH');
  const bucket = await orderFilesBucket();
  await bucket.put(path, data, { httpMetadata: { contentType, cacheControl: 'private, no-store' } });
}

export async function removeOrderFiles(paths: string[]): Promise<void> {
  const valid = paths.filter(isOrderFileStoragePath);
  if (valid.length === 0) return;
  const bucket = await orderFilesBucket();
  await bucket.delete(valid);
}

export async function getOrderFile(path: string): Promise<R2ObjectBodyLike | null> {
  if (!isOrderFileStoragePath(path)) return null;
  const bucket = await orderFilesBucket();
  return bucket.get(path);
}

// Links temporários de download são assinados com HMAC pelo próprio servidor.
// A chave é derivada do segredo service role, que já existe só no servidor.
function signingKey(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('FILE_URL_SIGNING_UNAVAILABLE');
  return crypto.createHmac('sha256', secret).update(`jk-order-file-url:${TOKEN_VERSION}`).digest();
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

export function createOrderFileDownloadUrl(input: {
  fileId: string;
  storagePath: string;
  expiresInSeconds: number;
}): string {
  if (!isOrderFileStoragePath(input.storagePath)) throw new Error('INVALID_STORAGE_PATH');
  const payload = Buffer.from(JSON.stringify({
    v: TOKEN_VERSION,
    f: input.fileId,
    p: input.storagePath,
    e: Math.floor(Date.now() / 1000) + input.expiresInSeconds,
  })).toString('base64url');
  return `/api/arquivos/download?t=${payload}.${sign(payload)}`;
}

export function verifyOrderFileDownloadToken(token: string | null): { fileId: string; storagePath: string } | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      v?: unknown; f?: unknown; p?: unknown; e?: unknown;
    };
    if (data.v !== TOKEN_VERSION || typeof data.f !== 'string' || typeof data.p !== 'string' || typeof data.e !== 'number') {
      return null;
    }
    if (data.e < Math.floor(Date.now() / 1000) || !isOrderFileStoragePath(data.p)) return null;
    return { fileId: data.f, storagePath: data.p };
  } catch {
    return null;
  }
}
