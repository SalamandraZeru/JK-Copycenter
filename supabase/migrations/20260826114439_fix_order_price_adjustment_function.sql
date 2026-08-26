-- Corrige a colisão entre a coluna order_id e a coluna de retorno da função.
create or replace function public.adjust_order_item_price(
  p_order_id uuid,
  p_order_item_id uuid,
  p_admin_user_id uuid,
  p_new_total_cents bigint,
  p_reason text,
  p_idempotency_key uuid
)
returns table (
  order_id uuid,
  subtotal_cents bigint,
  total_cents bigint,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
  v_existing public.order_price_adjustments%rowtype;
  v_new_subtotal_cents bigint;
  v_new_total_cents bigint;
begin
  if p_new_total_cents is null or p_new_total_cents < 0 or p_new_total_cents > 100000000 then
    raise exception using errcode = '22023', message = 'ORDER_PRICE_INVALID';
  end if;
  if nullif(btrim(p_reason), '') is null or char_length(btrim(p_reason)) < 3 or char_length(btrim(p_reason)) > 2000 then
    raise exception using errcode = '22023', message = 'ORDER_PRICE_REASON_REQUIRED';
  end if;

  perform 1
  from public.admin_users as admin_user
  where admin_user.id = p_admin_user_id and admin_user.is_active;
  if not found then
    raise exception using errcode = '42501', message = 'ORDER_PRICE_ACTOR_INVALID';
  end if;

  select adjustment.* into v_existing
  from public.order_price_adjustments as adjustment
  where adjustment.order_id = p_order_id
    and adjustment.idempotency_key = p_idempotency_key
  for update;
  if found then
    return query select v_existing.order_id, v_existing.new_order_subtotal_cents, v_existing.new_order_total_cents, true;
    return;
  end if;

  select placed_order.* into v_order
  from public.orders as placed_order
  where placed_order.id = p_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.status not in ('created', 'awaiting_payment') or v_order.payment_status <> 'pending_contact' then
    raise exception using errcode = '22023', message = 'ORDER_PRICE_ADJUSTMENT_LOCKED';
  end if;

  select order_item.* into v_item
  from public.order_items as order_item
  where order_item.id = p_order_item_id and order_item.order_id = v_order.id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_ITEM_NOT_FOUND';
  end if;

  if v_item.total_price_cents = p_new_total_cents then
    raise exception using errcode = '22023', message = 'ORDER_PRICE_ADJUSTMENT_NO_CHANGE';
  end if;

  v_new_subtotal_cents := v_order.subtotal_cents - v_item.total_price_cents + p_new_total_cents;
  v_new_total_cents := v_new_subtotal_cents + v_order.delivery_fee_cents;
  if v_new_subtotal_cents < 0 or v_new_total_cents < 0 then
    raise exception using errcode = '22003', message = 'ORDER_PRICE_TOTAL_INVALID';
  end if;

  update public.order_items as order_item
  set total_price_cents = p_new_total_cents,
      unit_price_cents = p_new_total_cents / greatest(order_item.quantity, 1)
  where order_item.id = v_item.id;

  update public.orders as placed_order
  set subtotal_cents = v_new_subtotal_cents,
      total_cents = v_new_total_cents,
      updated_at = now()
  where placed_order.id = v_order.id;

  insert into public.order_price_adjustments (
    order_id, order_item_id, admin_user_id, idempotency_key,
    previous_item_total_cents, new_item_total_cents,
    previous_order_subtotal_cents, new_order_subtotal_cents,
    previous_order_total_cents, new_order_total_cents, reason
  ) values (
    v_order.id, v_item.id, p_admin_user_id, p_idempotency_key,
    v_item.total_price_cents, p_new_total_cents,
    v_order.subtotal_cents, v_new_subtotal_cents,
    v_order.total_cents, v_new_total_cents, btrim(p_reason)
  );

  insert into public.audit_logs (admin_user_id, action, entity, entity_id, old_value, new_value)
  values (
    p_admin_user_id, 'adjust_order_item_price', 'orders', v_order.id,
    jsonb_build_object(
      'order_item_id', v_item.id,
      'item_total_cents', v_item.total_price_cents,
      'subtotal_cents', v_order.subtotal_cents,
      'total_cents', v_order.total_cents
    ),
    jsonb_build_object(
      'order_item_id', v_item.id,
      'item_total_cents', p_new_total_cents,
      'subtotal_cents', v_new_subtotal_cents,
      'total_cents', v_new_total_cents,
      'reason', btrim(p_reason)
    )
  );

  return query select v_order.id, v_new_subtotal_cents, v_new_total_cents, false;
end;
$$;

revoke all on function public.adjust_order_item_price(uuid, uuid, uuid, bigint, text, uuid)
  from public, anon, authenticated;
grant execute on function public.adjust_order_item_price(uuid, uuid, uuid, bigint, text, uuid)
  to service_role;
