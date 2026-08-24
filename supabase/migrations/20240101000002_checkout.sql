-- Etapa 12: Checkout e Pedidos (Number Sequence e Transaction)

-- 1. Sequence para número de pedido
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- 2. Função geradora de número
CREATE OR REPLACE FUNCTION next_order_number()
RETURNS TEXT AS $$
DECLARE
  seq INT;
BEGIN
  seq := nextval('order_number_seq');
  RETURN 'JK-' || EXTRACT(YEAR FROM NOW()) || '-'
         || LPAD(seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. Stored Procedure para criar pedido atomicamente
CREATE OR REPLACE FUNCTION create_order_transaction(
  p_order JSONB,
  p_items JSONB,
  p_file_ids JSONB,
  p_event JSONB
) RETURNS JSONB AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_order_item_id UUID;
  v_file_id UUID;
BEGIN
  -- Insert into orders
  INSERT INTO public.orders (
    id, user_id, order_number, order_token, idempotency_key, 
    status, guest_name, guest_phone, guest_email,
    payment_method, delivery_type, delivery_address_snapshot,
    subtotal, delivery_fee, total, pix_key_used, whatsapp_message_url, notes
  ) VALUES (
    (p_order->>'id')::uuid,
    NULLIF(p_order->>'user_id', '')::uuid,
    p_order->>'order_number',
    (p_order->>'order_token')::uuid,
    (p_order->>'idempotency_key')::uuid,
    COALESCE((p_order->>'status')::order_status, 'new'::order_status),
    p_order->>'guest_name',
    p_order->>'guest_phone',
    p_order->>'guest_email',
    (p_order->>'payment_method')::payment_method,
    COALESCE((p_order->>'delivery_type')::delivery_type, 'pickup'::delivery_type),
    p_order->'delivery_address_snapshot',
    (p_order->>'subtotal')::numeric,
    (p_order->>'delivery_fee')::numeric,
    (p_order->>'total')::numeric,
    p_order->>'pix_key_used',
    p_order->>'whatsapp_message_url',
    p_order->>'notes'
  ) RETURNING id INTO v_order_id;

  -- Insert order items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.order_items (
      id, order_id, service_id, product_id,
      service_name_snapshot, service_description_snapshot, product_name_snapshot,
      quantity, pages_count, pages_method, is_double_sided,
      unit_price, total_price, discount_applied,
      fields_snapshot, pricing_rule_id, pricing_rule_snapshot
    ) VALUES (
      (v_item->>'id')::uuid,
      v_order_id,
      NULLIF(v_item->>'service_id', '')::uuid,
      NULLIF(v_item->>'product_id', '')::uuid,
      v_item->>'service_name_snapshot',
      v_item->>'service_description_snapshot',
      v_item->>'product_name_snapshot',
      COALESCE((v_item->>'quantity')::integer, 1),
      COALESCE((v_item->>'pages_count')::integer, 0),
      COALESCE((v_item->>'pages_method')::page_count_method, 'exact'::page_count_method),
      COALESCE((v_item->>'is_double_sided')::boolean, false),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'total_price')::numeric, 0),
      COALESCE((v_item->>'discount_applied')::numeric, 0),
      COALESCE(v_item->'fields_snapshot', '{}'::jsonb),
      NULLIF(v_item->>'pricing_rule_id', '')::uuid,
      v_item->'pricing_rule_snapshot'
    ) RETURNING id INTO v_order_item_id;

    -- Update order_files linked to this item
    IF v_item->'file_ids' IS NOT NULL THEN
      FOR v_file_id IN SELECT jsonb_array_elements_text(v_item->'file_ids')::uuid
      LOOP
        UPDATE public.order_files
        SET order_id = v_order_id, order_item_id = v_order_item_id
        WHERE id = v_file_id;
      END LOOP;
    END IF;
  END LOOP;

  -- Insert event
  INSERT INTO public.order_events (
    order_id, from_status, to_status, admin_user_id, note
  ) VALUES (
    v_order_id,
    NULLIF(p_event->>'from_status', '')::order_status,
    COALESCE((p_event->>'to_status')::order_status, 'new'::order_status),
    NULLIF(p_event->>'user_id', '')::uuid,
    p_event->>'note'
  );

  RETURN jsonb_build_object('order_id', v_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
