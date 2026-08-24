import crypto from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { processCheckout } from '@/lib/orders/checkout';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const isLocal = ['127.0.0.1', 'localhost'].includes(supabaseUrl ? new URL(supabaseUrl).hostname : '');

describe.skipIf(!isLocal || !serviceRoleKey)('pagamento manual e WhatsApp no Postgres local', () => {
  let service: SupabaseClient<Database>;
  let adminId = '';
  let orderId = '';

  beforeAll(async () => {
    service = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const created = await service.auth.admin.createUser({
      email: `payment-${crypto.randomUUID()}@example.test`,
      password: 'TEST_JK_payment_only_123!',
      email_confirm: true,
    });
    if (created.error || !created.data.user) throw created.error || new Error('ADMIN_USER_CREATE_FAILED');
    adminId = created.data.user.id;
    const { error } = await service.from('admin_users').insert({
      id: adminId,
      full_name: 'TEST_JK Payment Admin',
      role: 'admin',
      is_active: true,
    });
    if (error) throw error;
  });

  afterAll(async () => {
    if (orderId) await service.from('orders').delete().eq('id', orderId);
    if (adminId) await service.auth.admin.deleteUser(adminId);
  });

  it('cria pedido pendente, outbox mínimo e confirma pagamento uma única vez', async () => {
    const guestEmail = `checkout-${crypto.randomUUID()}@example.test`;
    const checkout = await processCheckout({
      idempotencyKey: crypto.randomUUID(),
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
      customerName: 'TEST_JK Cliente',
      customerPhone: '35999990000',
      guestEmail,
    }, { guestEmail }, service);
    orderId = checkout.orderId;

    const { data: order, error: orderError } = await service
      .from('orders')
      .select('status, payment_status')
      .eq('id', orderId)
      .single();
    expect(orderError).toBeNull();
    expect(order).toMatchObject({ status: 'awaiting_payment', payment_status: 'pending_contact' });

    const { data: outbox, error: outboxError } = await service
      .from('order_contact_outbox')
      .select('payload, status')
      .eq('order_id', orderId)
      .single();
    expect(outboxError).toBeNull();
    expect(outbox?.status).toBe('prepared');
    expect(JSON.stringify(outbox?.payload)).not.toMatch(/pix_key|storage_path|original_name|guest.*token|signed/i);
    expect(checkout.whatsappUrl).toMatch(/^https:\/\/wa\.me\//);
    expect(decodeURIComponent(checkout.whatsappUrl)).not.toMatch(/TEST_JK_PIX|arquivo|pagamento aprovado/i);

    const idempotencyKey = crypto.randomUUID();
    const first = await service.rpc('process_manual_payment', {
      p_order_id: orderId,
      p_admin_user_id: adminId,
      p_action: 'paid',
      p_note: 'PIX conferido no extrato local de teste.',
      p_external_reference: 'TEST_JK_REF_001',
      p_idempotency_key: idempotencyKey,
    });
    expect(first.error).toBeNull();
    expect(first.data?.[0]).toMatchObject({ order_status: 'confirmed', payment_status: 'paid', replayed: false });

    const replay = await service.rpc('process_manual_payment', {
      p_order_id: orderId,
      p_admin_user_id: adminId,
      p_action: 'paid',
      p_note: 'PIX conferido no extrato local de teste.',
      p_external_reference: 'TEST_JK_REF_001',
      p_idempotency_key: idempotencyKey,
    });
    expect(replay.error).toBeNull();
    expect(replay.data?.[0]?.replayed).toBe(true);

    const { count: paymentEvents } = await service
      .from('order_payment_events')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', orderId);
    const { count: audits } = await service
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('entity_id', orderId)
      .eq('action', 'process_manual_payment');
    expect(paymentEvents).toBe(1);
    expect(audits).toBe(1);
  });

  it('anon não consegue invocar confirmação de pagamento privilegiada', async () => {
    const anon = createClient<Database>(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const result = await anon.rpc('process_manual_payment', {
      p_order_id: crypto.randomUUID(),
      p_admin_user_id: crypto.randomUUID(),
      p_action: 'paid',
      p_note: 'tentativa anon',
      p_external_reference: null,
      p_idempotency_key: crypto.randomUUID(),
    });
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });
});
