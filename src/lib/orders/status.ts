import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { OrderStatus } from '@/types/index';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['confirmed', 'cancelled'],
  confirmed: ['in_production', 'cancelled'],
  in_production: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function validateTransition(from: OrderStatus, to: OrderStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function updateOrderStatus(
  orderId: string,
  to: OrderStatus,
  adminUserId: string,
  note: string,
  idempotencyKey: string,
  supabase: SupabaseClient<Database>
): Promise<void> {
  const { error } = await supabase.rpc('transition_order_status', {
    p_order_id: orderId,
    p_admin_user_id: adminUserId,
    p_to_status: to,
    p_note: note,
    p_idempotency_key: idempotencyKey,
    p_allow_unpaid_confirmation: false,
  });
  if (error) throw new Error(`ORDER_TRANSITION_FAILED: ${error.message}`);
}
