import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { logAdminAction } from '@/lib/auth/admin';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import {
  buildOrderStatusWhatsAppUrl,
  normalizeWhatsAppRecipient,
  orderStatusTemplateKey,
} from '@/lib/orders/status-communication';

export const dynamic = 'force-dynamic';

const notificationSchema = z.object({
  status: z.enum(['created', 'awaiting_payment', 'confirmed', 'in_production', 'ready', 'completed', 'cancelled']),
  idempotencyKey: z.string().uuid(),
}).strict();

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ error: 'Requisição não autorizada.' }, { status: 403 });
  }
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID do pedido inválido.' }, { status: 400 });
  const auth = await requireApiAdminPermission('update_orders');
  if (!auth.success) return auth.errorResponse;
  const parsed = await parseAdminJson(request, notificationSchema);
  if (!parsed.success) return parsed.errorResponse;

  const supabase = createServiceRoleClient();
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, order_number, status, delivery_type, guest_phone, profiles (phone)')
    .eq('id', params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
  if (order.status !== parsed.data.status) {
    return NextResponse.json({ error: 'O status foi alterado. Atualize o pedido antes de abrir a comunicação.' }, { status: 409 });
  }

  const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
  const recipient = normalizeWhatsAppRecipient(order.guest_phone || profile?.phone);
  if (!recipient) return NextResponse.json({ error: 'O pedido não possui um telefone válido para WhatsApp.' }, { status: 409 });

  const templateKey = orderStatusTemplateKey(order.status);
  const { error: insertError } = await supabase
    .from('order_status_communications')
    .insert({
      order_id: order.id,
      admin_user_id: auth.session.id,
      idempotency_key: parsed.data.idempotencyKey,
      channel: 'whatsapp',
      status_to: order.status,
      template_key: templateKey,
    });
  if (insertError && !insertError.message.includes('order_status_communications_order_idempotency_unique')) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await logAdminAction(supabase, auth.session.id, 'open_order_status_whatsapp', 'orders', order.id, {
    channel: 'whatsapp',
    status: order.status,
    template_key: templateKey,
  });
  return NextResponse.json({
    success: true,
    url: buildOrderStatusWhatsAppUrl({
      recipient,
      orderNumber: order.order_number,
      status: order.status,
      deliveryType: order.delivery_type,
    }),
  });
}
