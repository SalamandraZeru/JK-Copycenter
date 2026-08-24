begin;

-- Estados explicitos mantem pedido e pagamento independentes. A conversao
-- preserva registros antigos sem tratar um pedido legado como pagamento pago.
alter table public.orders alter column status drop default;
alter type public.order_status rename to order_status_legacy;
create type public.order_status as enum (
  'created',
  'awaiting_payment',
  'confirmed',
  'in_production',
  'ready',
  'completed',
  'cancelled'
);

alter table public.orders
  alter column status type public.order_status
  using (
    case status::text
      when 'new' then 'awaiting_payment'
      when 'in_production' then 'in_production'
      when 'ready' then 'ready'
      when 'archived' then 'completed'
      when 'cancelled' then 'cancelled'
    end
  )::public.order_status,
  alter column status set default 'created'::public.order_status;

alter table public.order_events
  alter column from_status type public.order_status
  using (
    case from_status::text
      when 'new' then 'awaiting_payment'
      when 'in_production' then 'in_production'
      when 'ready' then 'ready'
      when 'archived' then 'completed'
      when 'cancelled' then 'cancelled'
      else null
    end
  )::public.order_status,
  alter column to_status type public.order_status
  using (
    case to_status::text
      when 'new' then 'awaiting_payment'
      when 'in_production' then 'in_production'
      when 'ready' then 'ready'
      when 'archived' then 'completed'
      when 'cancelled' then 'cancelled'
    end
  )::public.order_status;

drop type public.order_status_legacy;

alter table public.orders alter column payment_status drop default;
alter type public.payment_status rename to payment_status_legacy;
create type public.payment_status as enum (
  'pending_contact',
  'paid',
  'rejected',
  'cancelled'
);

alter table public.orders
  alter column payment_status type public.payment_status
  using (
    case payment_status::text
      when 'pending' then 'pending_contact'
      when 'confirmed' then 'paid'
      when 'cancelled' then 'cancelled'
    end
  )::public.payment_status,
  alter column payment_status set default 'pending_contact'::public.payment_status;

drop type public.payment_status_legacy;

create table public.order_payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  admin_user_id uuid not null references public.admin_users(id) on delete restrict,
  idempotency_key uuid not null,
  from_status public.payment_status not null,
  to_status public.payment_status not null,
  note text not null check (char_length(btrim(note)) between 1 and 2000),
  external_reference text check (external_reference is null or char_length(btrim(external_reference)) <= 256),
  created_at timestamptz not null default now(),
  unique (order_id, idempotency_key)
);

create index idx_order_payment_events_order_created
  on public.order_payment_events (order_id, created_at);

alter table public.order_events add column if not exists idempotency_key uuid;
create unique index if not exists order_events_order_idempotency_key
  on public.order_events (order_id, idempotency_key)
  where idempotency_key is not null;

create table public.order_contact_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  idempotency_key uuid not null,
  effect_type text not null check (effect_type = 'whatsapp_order_created'),
  status text not null default 'prepared' check (status in ('prepared', 'opened', 'failed')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  last_error text
);

create unique index order_contact_outbox_idempotency_key
  on public.order_contact_outbox (idempotency_key);

alter table public.order_payment_events enable row level security;
alter table public.order_contact_outbox enable row level security;
revoke all privileges on table public.order_payment_events, public.order_contact_outbox from public, anon, authenticated;
grant all privileges on table public.order_payment_events, public.order_contact_outbox to service_role;

insert into public.store_settings (key, value, value_type, value_schema, description, allowed_roles, is_sensitive)
values (
  'allow_unpaid_order_confirmation',
  'false'::jsonb,
  'boolean',
  '{"type":"boolean"}'::jsonb,
  'Excecao rara: permite confirmar pedido sem pagamento pago, sempre com justificativa e auditoria.',
  array['super_admin']::public.admin_role[],
  false
)
on conflict (key) do nothing;

-- Checkout permanece uma unica transacao e passa a registrar a transicao
-- CREATED -> AWAITING_PAYMENT mais um outbox minimo. Nenhum efeito externo e
-- disparado pelo banco ou antes do commit.
create or replace function public.commit_checkout(
  p_idempotency_key uuid,
  p_request_hash text,
  p_user_id uuid,
  p_guest_email text,
  p_guest_upload_session_hash text,
  p_order jsonb,
  p_items jsonb,
  p_file_ids uuid[]
)
returns table (
  order_id uuid,
  order_number text,
  order_code uuid,
  total_cents bigint,
  payment_method public.payment_method,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_hash text;
  v_existing public.orders%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_order_code uuid;
  v_item jsonb;
  v_item_id uuid;
  v_file_id uuid;
  v_user_id uuid := p_user_id;
  v_guest_email text := nullif(lower(btrim(p_guest_email)), '');
  v_delivery_type public.delivery_type;
  v_payment_method public.payment_method;
  v_delivery_address jsonb;
  v_delivery_fee_cents bigint;
  v_subtotal_cents bigint;
  v_total_cents bigint;
  v_guest_access_days integer;
  v_service_id uuid;
  v_product_id uuid;
  v_quantity integer;
  v_pages_count integer;
  v_pages_method public.page_count_method;
  v_is_double_sided boolean;
  v_unit_price_cents bigint;
  v_item_total_cents bigint;
  v_discount_cents bigint;
  v_pricing_rule_id uuid;
  v_expected_file_count integer := coalesce(cardinality(p_file_ids), 0);
  v_distinct_file_count integer := 0;
  v_linked_file_count integer := 0;
  v_total_linked_file_count integer := 0;
  v_items_total_cents bigint := 0;
  v_outbox_items jsonb := '[]'::jsonb;
begin
  if p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_IDEMPOTENCY_REQUEST_HASH';
  end if;
  if (v_user_id is null) = (v_guest_email is null) then
    raise exception using errcode = '22023', message = 'CHECKOUT_ACTOR_INVALID';
  end if;
  if v_user_id is not null and p_guest_upload_session_hash is not null then
    raise exception using errcode = '22023', message = 'CHECKOUT_ACTOR_INVALID';
  end if;
  if v_user_id is not null then
    v_actor_hash := encode(extensions.digest('user:' || v_user_id::text, 'sha256'), 'hex');
  else
    v_actor_hash := encode(extensions.digest('guest:' || v_guest_email, 'sha256'), 'hex');
    if v_expected_file_count > 0 and coalesce(p_guest_upload_session_hash, '') !~ '^[a-f0-9]{64}$' then
      raise exception using errcode = '22023', message = 'FILE_ACCESS_DENIED';
    end if;
  end if;
  if jsonb_typeof(p_order) <> 'object' or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'CHECKOUT_PAYLOAD_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor_hash || ':' || p_idempotency_key::text, 0));
  select * into v_existing from public.orders
  where checkout_actor_hash = v_actor_hash and idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.checkout_request_hash <> p_request_hash then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return query select v_existing.id, v_existing.order_number, v_existing.order_token, v_existing.total_cents, v_existing.payment_method, true;
    return;
  end if;

  v_delivery_type := (p_order ->> 'delivery_type')::public.delivery_type;
  v_payment_method := (p_order ->> 'payment_method')::public.payment_method;
  v_delivery_address := p_order -> 'delivery_address_snapshot';
  v_delivery_fee_cents := (p_order ->> 'delivery_fee_cents')::bigint;
  v_subtotal_cents := (p_order ->> 'subtotal_cents')::bigint;
  v_total_cents := (p_order ->> 'total_cents')::bigint;
  if v_delivery_fee_cents < 0 or v_subtotal_cents < 0 or v_total_cents <> v_delivery_fee_cents + v_subtotal_cents then
    raise exception using errcode = '22023', message = 'CHECKOUT_TOTAL_INVALID';
  end if;
  if v_delivery_type = 'delivery' and jsonb_typeof(v_delivery_address) <> 'object' then
    raise exception using errcode = '22023', message = 'DELIVERY_ADDRESS_REQUIRED';
  end if;
  if v_user_id is null then
    select (value #>> '{}')::integer into v_guest_access_days from public.store_settings where key = 'guest_order_access_days';
    if v_guest_access_days is null or v_guest_access_days < 1 then
      raise exception using errcode = '22023', message = 'CONFIG_UNAVAILABLE: guest_order_access_days';
    end if;
  end if;
  select count(distinct file_id) into v_distinct_file_count from unnest(coalesce(p_file_ids, '{}'::uuid[])) as file_id;
  if v_distinct_file_count <> v_expected_file_count then
    raise exception using errcode = '22023', message = 'FILE_ACCESS_DENIED';
  end if;

  v_order_id := pg_catalog.gen_random_uuid();
  v_order_code := pg_catalog.gen_random_uuid();
  v_order_number := format('JK-%s-%s', extract(year from current_date)::text, upper(substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 12)));
  insert into public.orders (
    id, order_number, order_token, user_id, guest_email, guest_name, guest_phone, guest_access_expires_at,
    idempotency_key, checkout_request_hash, checkout_actor_hash, status, delivery_type, delivery_address_snapshot,
    delivery_fee_cents, subtotal_cents, total_cents, payment_method, payment_status, pix_key_used, notes
  ) values (
    v_order_id, v_order_number, v_order_code, v_user_id, v_guest_email,
    nullif(btrim(p_order ->> 'guest_name'), ''), nullif(btrim(p_order ->> 'guest_phone'), ''),
    case when v_user_id is null then now() + make_interval(days => v_guest_access_days) else null end,
    p_idempotency_key, p_request_hash, v_actor_hash, 'awaiting_payment', v_delivery_type, v_delivery_address,
    v_delivery_fee_cents, v_subtotal_cents, v_total_cents, v_payment_method, 'pending_contact',
    nullif(p_order ->> 'pix_key_used', ''), nullif(btrim(p_order ->> 'notes'), '')
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then raise exception using errcode = '22023', message = 'CHECKOUT_ITEM_INVALID'; end if;
    v_service_id := nullif(v_item ->> 'service_id', '')::uuid;
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    if (v_service_id is null) = (v_product_id is null) then raise exception using errcode = '22023', message = 'CHECKOUT_ITEM_INVALID'; end if;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_pages_count := coalesce((v_item ->> 'pages_count')::integer, 0);
    v_pages_method := coalesce((v_item ->> 'pages_method')::public.page_count_method, 'exact');
    v_is_double_sided := coalesce((v_item ->> 'is_double_sided')::boolean, false);
    v_unit_price_cents := (v_item ->> 'unit_price_cents')::bigint;
    v_item_total_cents := (v_item ->> 'total_price_cents')::bigint;
    v_discount_cents := coalesce((v_item ->> 'discount_cents')::bigint, 0);
    v_pricing_rule_id := nullif(v_item ->> 'pricing_rule_id', '')::uuid;
    if v_quantity < 1 or v_pages_count < 0 or v_unit_price_cents < 0 or v_item_total_cents < 0 or v_discount_cents < 0 then
      raise exception using errcode = '22023', message = 'CHECKOUT_ITEM_INVALID';
    end if;
    v_items_total_cents := v_items_total_cents + v_item_total_cents;
    insert into public.order_items (
      order_id, service_id, product_id, service_name_snapshot, service_description_snapshot, product_name_snapshot,
      fields_snapshot, quantity, pages_count, pages_method, is_double_sided, unit_price_cents, total_price_cents,
      pricing_rule_id, pricing_rule_snapshot, discount_cents
    ) values (
      v_order_id, v_service_id, v_product_id, nullif(v_item ->> 'service_name_snapshot', ''),
      nullif(v_item ->> 'service_description_snapshot', ''), nullif(v_item ->> 'product_name_snapshot', ''),
      coalesce(v_item -> 'fields_snapshot', '{}'::jsonb), v_quantity, v_pages_count, v_pages_method, v_is_double_sided,
      v_unit_price_cents, v_item_total_cents, v_pricing_rule_id, v_item -> 'pricing_rule_snapshot', v_discount_cents
    ) returning id into v_item_id;
    v_outbox_items := v_outbox_items || jsonb_build_array(jsonb_build_object(
      'name', coalesce(nullif(v_item ->> 'service_name_snapshot', ''), nullif(v_item ->> 'product_name_snapshot', ''), 'Item'),
      'quantity', v_quantity
    ));
    if coalesce(v_item -> 'file_ids', '[]'::jsonb) <> '[]'::jsonb and jsonb_typeof(v_item -> 'file_ids') <> 'array' then
      raise exception using errcode = '22023', message = 'CHECKOUT_ITEM_INVALID';
    end if;
    for v_file_id in select value::uuid from jsonb_array_elements_text(coalesce(v_item -> 'file_ids', '[]'::jsonb))
    loop
      update public.order_files as file set order_id = v_order_id, order_item_id = v_item_id
      where file.id = v_file_id and file.order_id is null and file.status = 'ready' and file.deleted_at is null
        and (file.expires_at is null or file.expires_at > now())
        and ((v_user_id is not null and file.user_id = v_user_id and file.guest_owner_hash is null)
          or (v_user_id is null and file.user_id is null and file.guest_owner_hash = p_guest_upload_session_hash));
      get diagnostics v_linked_file_count = row_count;
      if v_linked_file_count <> 1 then raise exception using errcode = '42501', message = 'FILE_ACCESS_DENIED'; end if;
    end loop;
  end loop;
  if v_items_total_cents <> v_subtotal_cents then raise exception using errcode = '22023', message = 'CHECKOUT_TOTAL_INVALID'; end if;
  select count(*) into v_total_linked_file_count from public.order_files as file where file.order_id = v_order_id;
  if v_total_linked_file_count <> v_expected_file_count then raise exception using errcode = '22023', message = 'FILE_ACCESS_DENIED'; end if;
  if v_expected_file_count > 0 and exists (
    select 1 from unnest(p_file_ids) as expected_file_id
    left join public.order_files as file on file.id = expected_file_id and file.order_id = v_order_id
    where file.id is null
  ) then raise exception using errcode = '22023', message = 'FILE_ACCESS_DENIED'; end if;

  insert into public.order_events (order_id, from_status, to_status, note)
  values
    (v_order_id, null, 'created', 'Pedido criado no checkout transacional'),
    (v_order_id, 'created', 'awaiting_payment', 'Aguardando confirmação manual de pagamento');
  insert into public.order_contact_outbox (order_id, idempotency_key, effect_type, payload)
  values (v_order_id, p_idempotency_key, 'whatsapp_order_created', jsonb_build_object(
    'order_number', v_order_number, 'items', v_outbox_items, 'total_cents', v_total_cents,
    'payment_method', v_payment_method::text, 'customer_name', nullif(btrim(p_order ->> 'guest_name'), ''),
    'customer_phone', nullif(btrim(p_order ->> 'guest_phone'), ''), 'delivery_type', v_delivery_type::text
  ));
  return query select v_order_id, v_order_number, v_order_code, v_total_cents, v_payment_method, false;
end;
$$;

create or replace function public.process_manual_payment(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_action text,
  p_note text,
  p_external_reference text,
  p_idempotency_key uuid
)
returns table (
  order_id uuid,
  order_status public.order_status,
  payment_status public.payment_status,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment_status public.payment_status;
  v_order_status public.order_status;
begin
  if p_action not in ('paid', 'rejected', 'cancelled') then
    raise exception using errcode = '22023', message = 'PAYMENT_ACTION_INVALID';
  end if;
  if nullif(btrim(p_note), '') is null then
    raise exception using errcode = '22023', message = 'PAYMENT_NOTE_REQUIRED';
  end if;
  if char_length(coalesce(p_external_reference, '')) > 256 then
    raise exception using errcode = '22023', message = 'PAYMENT_REFERENCE_INVALID';
  end if;
  perform 1 from public.admin_users where id = p_admin_user_id and is_active;
  if not found then raise exception using errcode = '42501', message = 'PAYMENT_ACTOR_INVALID'; end if;
  perform 1 from public.order_payment_events as payment_event
  where payment_event.order_id = p_order_id and payment_event.idempotency_key = p_idempotency_key for update;
  if found then
    select * into v_order from public.orders where id = p_order_id;
    return query select v_order.id, v_order.status, v_order.payment_status, true;
    return;
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
  if v_order.payment_status <> 'pending_contact' then
    raise exception using errcode = '22023', message = 'PAYMENT_ALREADY_FINALIZED';
  end if;
  if v_order.status <> 'awaiting_payment' then
    raise exception using errcode = '22023', message = 'ORDER_NOT_AWAITING_PAYMENT';
  end if;
  v_payment_status := p_action::public.payment_status;
  v_order_status := case when p_action = 'paid' then 'confirmed'::public.order_status else 'cancelled'::public.order_status end;
  update public.orders set payment_status = v_payment_status, status = v_order_status, updated_at = now() where id = v_order.id;
  insert into public.order_payment_events (order_id, admin_user_id, idempotency_key, from_status, to_status, note, external_reference)
  values (v_order.id, p_admin_user_id, p_idempotency_key, v_order.payment_status, v_payment_status, btrim(p_note), nullif(btrim(p_external_reference), ''));
  insert into public.order_events (order_id, admin_user_id, from_status, to_status, note)
  values (v_order.id, p_admin_user_id, v_order.status, v_order_status, btrim(p_note));
  insert into public.audit_logs (admin_user_id, action, entity, entity_id, old_value, new_value)
  values (p_admin_user_id, 'process_manual_payment', 'orders', v_order.id,
    jsonb_build_object('order_status', v_order.status, 'payment_status', v_order.payment_status),
    jsonb_build_object('order_status', v_order_status, 'payment_status', v_payment_status, 'action', p_action, 'external_reference', nullif(btrim(p_external_reference), '')));
  return query select v_order.id, v_order_status, v_payment_status, false;
end;
$$;

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_to_status public.order_status,
  p_note text,
  p_idempotency_key uuid,
  p_allow_unpaid_confirmation boolean default false
)
returns table (order_id uuid, order_status public.order_status, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_unpaid_confirmation_enabled boolean := false;
  v_allowed boolean := false;
begin
  if nullif(btrim(p_note), '') is null then raise exception using errcode = '22023', message = 'ORDER_STATUS_NOTE_REQUIRED'; end if;
  perform 1 from public.admin_users where id = p_admin_user_id and is_active;
  if not found then raise exception using errcode = '42501', message = 'ORDER_ACTOR_INVALID'; end if;
  perform 1 from public.order_events as order_event
  where order_event.order_id = p_order_id and order_event.idempotency_key = p_idempotency_key for update;
  if found then
    select * into v_order from public.orders where id = p_order_id;
    return query select v_order.id, v_order.status, true;
    return;
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
  v_allowed := (v_order.status = 'confirmed' and p_to_status in ('in_production', 'cancelled'))
    or (v_order.status = 'in_production' and p_to_status in ('ready', 'cancelled'))
    or (v_order.status = 'ready' and p_to_status in ('completed', 'cancelled'))
    or (v_order.status in ('created', 'awaiting_payment') and p_to_status = 'cancelled');
  if p_to_status = 'confirmed' and v_order.status = 'awaiting_payment' then
    select coalesce((value #>> '{}')::boolean, false) into v_unpaid_confirmation_enabled
    from public.store_settings where key = 'allow_unpaid_order_confirmation';
    v_allowed := v_order.payment_status = 'paid' or (p_allow_unpaid_confirmation and v_unpaid_confirmation_enabled);
  end if;
  if not v_allowed then raise exception using errcode = '22023', message = 'INVALID_ORDER_STATE_TRANSITION'; end if;
  if p_to_status = 'confirmed' and v_order.payment_status <> 'paid' and not (p_allow_unpaid_confirmation and v_unpaid_confirmation_enabled) then
    raise exception using errcode = '22023', message = 'ORDER_CONFIRMATION_REQUIRES_PAYMENT';
  end if;
  update public.orders set status = p_to_status, updated_at = now() where id = v_order.id;
  insert into public.order_events (order_id, admin_user_id, from_status, to_status, note, idempotency_key)
  values (v_order.id, p_admin_user_id, v_order.status, p_to_status, btrim(p_note), p_idempotency_key);
  insert into public.audit_logs (admin_user_id, action, entity, entity_id, old_value, new_value)
  values (p_admin_user_id, 'transition_order_status', 'orders', v_order.id,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', p_to_status, 'unpaid_confirmation_exception', p_allow_unpaid_confirmation));
  return query select v_order.id, p_to_status, false;
end;
$$;

revoke all on function public.commit_checkout(uuid, text, uuid, text, text, jsonb, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.commit_checkout(uuid, text, uuid, text, text, jsonb, jsonb, uuid[]) to service_role;
revoke all on function public.process_manual_payment(uuid, uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.process_manual_payment(uuid, uuid, text, text, text, uuid) to service_role;
revoke all on function public.transition_order_status(uuid, uuid, public.order_status, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.transition_order_status(uuid, uuid, public.order_status, text, uuid, boolean) to service_role;

comment on table public.order_payment_events is 'Eventos imutaveis de confirmacao manual de pagamento, idempotentes por pedido.';
comment on table public.order_contact_outbox is 'Handoff transacional do pedido para contato via WhatsApp; nao confirma entrega externa.';

commit;
