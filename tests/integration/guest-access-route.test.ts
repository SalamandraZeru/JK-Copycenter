import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/pedidos/consulta/route';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const isLocal = ['127.0.0.1', 'localhost'].includes(supabaseUrl ? new URL(supabaseUrl).hostname : '');

describe.runIf(isLocal)('consulta guest no staging local real', () => {
  let service: SupabaseClient<Database>;
  const orderId = crypto.randomUUID();
  const orderCode = crypto.randomUUID();
  const email = `guest-${crypto.randomUUID()}@example.test`;

  beforeAll(async () => {
    service = createClient<Database>(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { error } = await service.from('orders').insert({
      id: orderId,
      guest_email: email,
      guest_name: 'Guest Integration',
      guest_access_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      order_token: orderCode,
      idempotency_key: crypto.randomUUID(),
      checkout_request_hash: createHash('sha256').update(`request:${orderId}`).digest('hex'),
      checkout_actor_hash: createHash('sha256').update(`guest:${email}`).digest('hex'),
      payment_method: 'pix',
      delivery_fee_cents: 0,
      subtotal_cents: 0,
      total_cents: 0,
    });
    if (error) throw error;
  });

  afterAll(async () => {
    const codeHash = createHash('sha256').update(orderCode).digest('hex');
    await service.from('guest_access_attempts').delete().eq('order_code_hash', codeHash);
    await service.from('orders').delete().eq('id', orderId);
  });

  async function lookup(body: unknown) {
    const request = new NextRequest('http://127.0.0.1:3000/api/pedidos/consulta', {
      method: 'POST',
      headers: { origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return POST(request);
  }

  it('aceita código + e-mail normalizado sem devolver identidade ou código', async () => {
    const response = await lookup({ orderCode, email: email.toUpperCase() });
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.id).toBe(orderId);
    expect(payload.data).not.toHaveProperty('guest_email');
    expect(payload.data).not.toHaveProperty('order_token');
  });

  it('responde de forma genérica para e-mail incorreto', async () => {
    const response = await lookup({ orderCode, email: `wrong-${email}` });
    expect(response.status).toBe(404);
  });
});
