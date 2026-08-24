import crypto from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/supabase';
import type { CheckoutPayload } from '@/types/checkout';
import { processCheckout } from '@/lib/orders/checkout';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const isLocal = ['127.0.0.1', 'localhost'].includes(
  supabaseUrl ? new URL(supabaseUrl).hostname : '',
);
const clientUrl = supabaseUrl || 'http://127.0.0.1:54321';
const clientKey = serviceRoleKey || 'integration-test-not-configured';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

describe.skipIf(!isLocal || !serviceRoleKey)('idempotência de checkout no Postgres local', () => {
  let service: SupabaseClient<Database>;
  const guestEmail = `checkout-${crypto.randomUUID()}@example.test`;
  const actorHash = sha256(`guest:${guestEmail}`);
  const createdOrderIds: string[] = [];
  const createdFileIds: string[] = [];

  beforeAll(() => {
    service = createClient<Database>(clientUrl, clientKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await service.from('orders').delete().in('id', createdOrderIds);
    }
    if (createdFileIds.length > 0) {
      await service.from('order_files').delete().in('id', createdFileIds);
    }
  });

  function args(
    key: string,
    requestHash: string,
    productId?: string,
    fileIds: string[] = [],
    guestSessionHash: string | null = null,
  ) {
    return {
      p_idempotency_key: key,
      p_request_hash: requestHash,
      p_user_id: null,
      p_guest_email: guestEmail,
      p_guest_upload_session_hash: guestSessionHash,
      p_order: {
        guest_name: 'TEST_JK Checkout',
        guest_phone: '35999990000',
        delivery_type: 'pickup',
        delivery_address_snapshot: null,
        delivery_fee_cents: 0,
        subtotal_cents: 500,
        total_cents: 500,
        payment_method: 'pix',
        pix_key_used: 'TEST_JK_PIX',
        notes: null,
      } as Json,
      p_items: [{
        service_id: productId ? null : '33333333-3333-3333-3333-333333333333',
        product_id: productId || null,
        service_name_snapshot: productId ? null : 'TEST_JK Serviço',
        service_description_snapshot: null,
        product_name_snapshot: productId ? 'TEST_JK Produto' : null,
        fields_snapshot: {},
        quantity: 1,
        pages_count: 1,
        pages_method: 'exact',
        is_double_sided: false,
        unit_price_cents: 500,
        total_price_cents: 500,
        pricing_rule_id: null,
        pricing_rule_snapshot: null,
        discount_cents: 0,
        file_ids: fileIds,
      }] as Json,
      p_file_ids: fileIds,
    };
  }

  it('duas requisições simultâneas criam um único pedido e uma é replay', async () => {
    const key = crypto.randomUUID();
    const payload: CheckoutPayload = {
      idempotencyKey: key,
      items: [{
        serviceId: '33333333-3333-3333-3333-333333333333',
        attributeIds: [
          '66666666-6666-6666-6666-666666666661',
          '66666666-6666-6666-6666-666666666663',
          '66666666-6666-6666-6666-666666666665',
        ],
        fieldValues: [{ fieldKey: 'color', value: 'bw' }],
        pageCount: 1,
        isFrontAndBack: false,
        quantity: 1,
        fileIds: [],
      }],
      deliveryType: 'pickup',
      paymentMethod: 'pix',
      customerName: 'TEST_JK Checkout',
      customerPhone: '35999990000',
      guestEmail,
    };
    const [first, second] = await Promise.all([
      processCheckout(payload, { guestEmail }, service),
      processCheckout(payload, { guestEmail }, service),
    ]);

    expect(first.orderId).toBeDefined();
    expect(second.orderId).toBe(first.orderId);
    expect(first.orderNumber).toMatch(/^JK-\d{4}-[A-F0-9]{12}$/);
    expect(first.whatsappUrl).toContain('https://wa.me/');
    createdOrderIds.push(first.orderId);

    const { count, error } = await service
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('checkout_actor_hash', actorHash)
      .eq('idempotency_key', key);
    expect(error).toBeNull();
    expect(count).toBe(1);
  });

  it('mesma chave e payload diferente retorna conflito sem novo pedido', async () => {
    const key = crypto.randomUUID();
    const first = await service.rpc('commit_checkout', args(key, sha256('payload-a')));
    expect(first.error).toBeNull();
    if (first.data?.[0]) createdOrderIds.push(first.data[0].order_id);

    const conflict = await service.rpc('commit_checkout', args(key, sha256('payload-b')));
    expect(conflict.data).toBeNull();
    expect(conflict.error?.message).toContain('IDEMPOTENCY_CONFLICT');
  });

  it('falha ao inserir item reverte o pedido, evento e vínculo relacional', async () => {
    const key = crypto.randomUUID();
    const failed = await service.rpc(
      'commit_checkout',
      args(key, sha256('rollback-checkout'), crypto.randomUUID()),
    );
    expect(failed.data).toBeNull();
    expect(failed.error).not.toBeNull();

    const { count, error } = await service
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('checkout_actor_hash', actorHash)
      .eq('idempotency_key', key);
    expect(error).toBeNull();
    expect(count).toBe(0);
  });

  it('não vincula arquivo READY pertencente a outra sessão guest', async () => {
    const foreignFileId = crypto.randomUUID();
    createdFileIds.push(foreignFileId);
    const foreignSessionHash = sha256('TEST_JK foreign upload session');
    const attemptedSessionHash = sha256('TEST_JK attempted upload session');
    const { error: fileError } = await service.from('order_files').insert({
      id: foreignFileId,
      ownership_version: 1,
      guest_owner_hash: foreignSessionHash,
      original_name: 'TEST_JK-foreign.pdf',
      safe_name: 'TEST_JK-foreign.pdf',
      declared_mime_type: 'application/pdf',
      detected_mime_type: 'application/pdf',
      content_sha256: sha256('TEST_JK foreign content'),
      storage_path: `private/${foreignFileId}/${crypto.randomUUID()}.bin`,
      mime_type: 'application/pdf',
      file_type: 'pdf',
      size_bytes: 1,
      page_count: 1,
      page_count_method: 'exact',
      status: 'ready',
      ready_at: new Date().toISOString(),
    });
    expect(fileError).toBeNull();

    const key = crypto.randomUUID();
    const rejected = await service.rpc(
      'commit_checkout',
      args(key, sha256('foreign-file-checkout'), undefined, [foreignFileId], attemptedSessionHash),
    );
    expect(rejected.data).toBeNull();
    expect(rejected.error?.message).toContain('FILE_ACCESS_DENIED');

    const { data: file } = await service
      .from('order_files')
      .select('order_id')
      .eq('id', foreignFileId)
      .single();
    expect(file?.order_id).toBeNull();
  });

  it('anon não pode invocar o commit privilegiado', async () => {
    const anon = createClient<Database>(clientUrl, anonKey || 'integration-test-not-configured', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const result = await anon.rpc('commit_checkout', args(crypto.randomUUID(), sha256('anon-call')));
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });
});
