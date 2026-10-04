// Web Push sem dependências: criptografia aes128gcm (RFC 8291) e VAPID (RFC 8292)
// usando apenas Web Crypto, que existe tanto no Worker da Cloudflare quanto no Node.

const encoder = new TextEncoder();

/** Bytes sobre ArrayBuffer comum, como a Web Crypto exige. */
type Bytes = Uint8Array<ArrayBuffer>;
const RECORD_SIZE = 4096;

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidKeys {
  /** Chave pública P-256 não comprimida (65 bytes) em base64url. */
  publicKey: string;
  /** Escalar privado P-256 (32 bytes) em base64url. */
  privateKey: string;
  /** Contato do remetente: URL https ou mailto. */
  subject: string;
}

export interface EncryptOverrides {
  salt?: Bytes;
  senderKeys?: { publicKey: Bytes; privateKey: CryptoKey };
}

export function base64UrlToBytes(value: string): Bytes {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Bytes {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, length: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

/** Importa um par P-256 a partir dos bytes crus (pública 65 bytes, privada 32 bytes). */
export async function importP256PrivateKey(
  publicKey: Bytes,
  privateKey: Bytes,
  algorithm: 'ECDH' | 'ECDSA',
): Promise<CryptoKey> {
  if (publicKey.length !== 65 || publicKey[0] !== 4 || privateKey.length !== 32) {
    throw new Error('PUSH_INVALID_P256_KEY');
  }
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToBase64Url(publicKey.slice(1, 33)),
    y: bytesToBase64Url(publicKey.slice(33, 65)),
    d: bytesToBase64Url(privateKey),
    ext: false,
  };
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: algorithm, namedCurve: 'P-256' },
    false,
    algorithm === 'ECDH' ? ['deriveBits'] : ['sign'],
  );
}

/** Cifra a mensagem para um único registro aes128gcm (RFC 8291 §3 e RFC 8188). */
export async function encryptPushPayload(
  payload: Bytes,
  subscription: Pick<PushSubscriptionKeys, 'p256dh' | 'auth'>,
  overrides: EncryptOverrides = {},
): Promise<Bytes> {
  const receiverPublic = base64UrlToBytes(subscription.p256dh);
  const authSecret = base64UrlToBytes(subscription.auth);
  if (receiverPublic.length !== 65 || authSecret.length !== 16) throw new Error('PUSH_INVALID_SUBSCRIPTION_KEYS');
  if (payload.length > RECORD_SIZE - 17 - 86) throw new Error('PUSH_PAYLOAD_TOO_LARGE');

  let senderPublic: Bytes;
  let senderPrivate: CryptoKey;
  if (overrides.senderKeys) {
    senderPublic = overrides.senderKeys.publicKey;
    senderPrivate = overrides.senderKeys.privateKey;
  } else {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
    senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
    senderPrivate = pair.privateKey;
  }

  const receiverKey = await crypto.subtle.importKey('raw', receiverPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, senderPrivate, 256));

  const keyInfo = concat(encoder.encode('WebPush: info\0'), receiverPublic, senderPublic);
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);
  const salt = overrides.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const contentKey = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt']);
  // Registro único: conteúdo seguido do delimitador 0x02 (último registro), sem preenchimento.
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    concat(payload, new Uint8Array([2])),
  ));

  const header = new Uint8Array(16 + 4 + 1 + senderPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = senderPublic.length;
  header.set(senderPublic, 21);
  return concat(header, ciphertext);
}

/** JWT ES256 do VAPID, válido por 12 horas para a origem do serviço de push. */
export async function createVapidAuthorization(endpoint: string, vapid: VapidKeys, now = Date.now()): Promise<string> {
  const audience = new URL(endpoint).origin;
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = bytesToBase64Url(encoder.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(now / 1000) + 12 * 60 * 60,
    sub: vapid.subject,
  })));
  const signingKey = await importP256PrivateKey(base64UrlToBytes(vapid.publicKey), base64UrlToBytes(vapid.privateKey), 'ECDSA');
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    encoder.encode(`${header}.${claims}`),
  ));
  return `vapid t=${header}.${claims}.${bytesToBase64Url(signature)}, k=${vapid.publicKey}`;
}

// Somente serviços de push reais dos navegadores: impede que o servidor seja usado
// para enviar requisições a endereços arbitrários informados pelo cliente.
const PUSH_SERVICE_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && url.port === '' && PUSH_SERVICE_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

export type PushSendResult = 'sent' | 'gone' | 'failed';

export async function sendWebPush(
  subscription: PushSubscriptionKeys,
  message: unknown,
  vapid: VapidKeys,
  options: { ttlSeconds?: number; urgency?: 'normal' | 'high'; topic?: string } = {},
): Promise<PushSendResult> {
  if (!isAllowedPushEndpoint(subscription.endpoint)) return 'gone';
  const body = await encryptPushPayload(encoder.encode(JSON.stringify(message)), subscription);
  const headers: Record<string, string> = {
    Authorization: await createVapidAuthorization(subscription.endpoint, vapid),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(options.ttlSeconds ?? 24 * 60 * 60),
    Urgency: options.urgency ?? 'high',
  };
  if (options.topic) headers.Topic = options.topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);

  try {
    const response = await fetch(subscription.endpoint, { method: 'POST', headers, body });
    if (response.status === 404 || response.status === 410) return 'gone';
    return response.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}
