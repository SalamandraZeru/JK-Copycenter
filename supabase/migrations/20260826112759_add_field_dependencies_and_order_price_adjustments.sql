-- Restrições entre opções de campos dinâmicos e ajustes finais auditáveis.
-- Nenhuma das duas estruturas é exposta diretamente ao navegador: a aplicação
-- usa rotas administrativas autenticadas e a service_role no servidor.

create table public.service_field_option_dependencies (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  source_field_id uuid not null references public.service_fields(id) on delete cascade,
  source_option_value text not null check (char_length(btrim(source_option_value)) between 1 and 200),
  target_field_id uuid not null references public.service_fields(id) on delete cascade,
  target_option_value text not null check (char_length(btrim(target_option_value)) between 1 and 200),
  created_at timestamptz not null default now(),
  constraint service_field_option_dependencies_distinct_fields check (source_field_id <> target_field_id),
  constraint service_field_option_dependencies_unique_link
    unique (source_field_id, source_option_value, target_field_id, target_option_value)
);

create index service_field_option_dependencies_service_target_idx
  on public.service_field_option_dependencies (service_id, target_field_id);

alter table public.service_field_option_dependencies enable row level security;
revoke all on table public.service_field_option_dependencies from public, anon, authenticated;
grant select, insert, update, delete on table public.service_field_option_dependencies to service_role;

create or replace function private.validate_service_field_option_dependency()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source_service_id uuid;
  v_target_service_id uuid;
  v_source_type public.field_type;
  v_target_type public.field_type;
  v_source_options jsonb;
  v_target_options jsonb;
begin
  select service_id, field_type, options
    into v_source_service_id, v_source_type, v_source_options
  from public.service_fields
  where id = new.source_field_id and is_active;

  select service_id, field_type, options
    into v_target_service_id, v_target_type, v_target_options
  from public.service_fields
  where id = new.target_field_id and is_active;

  if v_source_service_id is null
     or v_target_service_id is null
     or v_source_service_id <> v_target_service_id
     or new.service_id <> v_source_service_id then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_DEPENDENCY_SERVICE_MISMATCH';
  end if;

  if v_source_type not in ('select', 'radio') or v_target_type not in ('select', 'radio') then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_DEPENDENCY_OPTION_FIELD_REQUIRED';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(coalesce(v_source_options, '[]'::jsonb)) as option_row(value)
    where option_row.value ->> 'value' = new.source_option_value
      and coalesce((option_row.value ->> 'is_active')::boolean, true)
  ) then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_DEPENDENCY_SOURCE_OPTION_INVALID';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(coalesce(v_target_options, '[]'::jsonb)) as option_row(value)
    where option_row.value ->> 'value' = new.target_option_value
      and coalesce((option_row.value ->> 'is_active')::boolean, true)
  ) then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_DEPENDENCY_TARGET_OPTION_INVALID';
  end if;

  return new;
end;
$$;

create trigger service_field_option_dependencies_guard
before insert or update on public.service_field_option_dependencies
for each row execute function private.validate_service_field_option_dependency();

create or replace function private.bump_service_pricing_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_service_id uuid;
begin
  if tg_table_name = 'services' then
    if row(new.base_price_cents, new.pricing_fallback_behavior, new.is_active, new.deleted_at)
       is distinct from
       row(old.base_price_cents, old.pricing_fallback_behavior, old.is_active, old.deleted_at) then
      new.pricing_version := old.pricing_version + 1;
    end if;
    return new;
  end if;

  v_service_id := case
    when tg_table_name = 'service_fields' then coalesce(new.service_id, old.service_id)
    when tg_table_name = 'pricing_rules' then coalesce(new.service_id, old.service_id)
    when tg_table_name = 'pricing_discounts' then coalesce(new.service_id, old.service_id)
    when tg_table_name = 'service_field_option_dependencies' then coalesce(new.service_id, old.service_id)
    else null
  end;

  if v_service_id is not null then
    update public.services
    set pricing_version = pricing_version + 1
    where id = v_service_id;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger service_field_option_dependencies_pricing_version_bump
after insert or update or delete on public.service_field_option_dependencies
for each row execute function private.bump_service_pricing_version();

create table public.order_price_adjustments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  admin_user_id uuid references public.admin_users(id) on delete set null,
  idempotency_key uuid not null,
  previous_item_total_cents bigint not null check (previous_item_total_cents >= 0),
  new_item_total_cents bigint not null check (new_item_total_cents >= 0),
  previous_order_subtotal_cents bigint not null check (previous_order_subtotal_cents >= 0),
  new_order_subtotal_cents bigint not null check (new_order_subtotal_cents >= 0),
  previous_order_total_cents bigint not null check (previous_order_total_cents >= 0),
  new_order_total_cents bigint not null check (new_order_total_cents >= 0),
  reason text not null check (char_length(btrim(reason)) between 3 and 2000),
  created_at timestamptz not null default now(),
  constraint order_price_adjustments_order_idempotency_unique unique (order_id, idempotency_key)
);

create index order_price_adjustments_order_created_idx
  on public.order_price_adjustments (order_id, created_at desc);

alter table public.order_price_adjustments enable row level security;
revoke all on table public.order_price_adjustments from public, anon, authenticated;
grant select, insert on table public.order_price_adjustments to service_role;

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
  from public.admin_users
  where id = p_admin_user_id and is_active;
  if not found then
    raise exception using errcode = '42501', message = 'ORDER_PRICE_ACTOR_INVALID';
  end if;

  select * into v_existing
  from public.order_price_adjustments
  where order_id = p_order_id and idempotency_key = p_idempotency_key
  for update;
  if found then
    return query select v_existing.order_id, v_existing.new_order_subtotal_cents, v_existing.new_order_total_cents, true;
    return;
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;

  if v_order.status not in ('created', 'awaiting_payment') or v_order.payment_status <> 'pending_contact' then
    raise exception using errcode = '22023', message = 'ORDER_PRICE_ADJUSTMENT_LOCKED';
  end if;

  select * into v_item
  from public.order_items
  where id = p_order_item_id and order_id = v_order.id
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

  update public.order_items
  set total_price_cents = p_new_total_cents,
      unit_price_cents = p_new_total_cents / greatest(quantity, 1)
  where id = v_item.id;

  update public.orders
  set subtotal_cents = v_new_subtotal_cents,
      total_cents = v_new_total_cents,
      updated_at = now()
  where id = v_order.id;

  insert into public.order_price_adjustments (
    order_id,
    order_item_id,
    admin_user_id,
    idempotency_key,
    previous_item_total_cents,
    new_item_total_cents,
    previous_order_subtotal_cents,
    new_order_subtotal_cents,
    previous_order_total_cents,
    new_order_total_cents,
    reason
  ) values (
    v_order.id,
    v_item.id,
    p_admin_user_id,
    p_idempotency_key,
    v_item.total_price_cents,
    p_new_total_cents,
    v_order.subtotal_cents,
    v_new_subtotal_cents,
    v_order.total_cents,
    v_new_total_cents,
    btrim(p_reason)
  );

  insert into public.audit_logs (admin_user_id, action, entity, entity_id, old_value, new_value)
  values (
    p_admin_user_id,
    'adjust_order_item_price',
    'orders',
    v_order.id,
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

comment on table public.service_field_option_dependencies is
  'Vínculos administrativos que restringem as opções disponíveis entre campos do mesmo serviço.';
comment on table public.order_price_adjustments is
  'Histórico imutável de ajustes finais de preço feitos antes da confirmação de pagamento.';
comment on function public.adjust_order_item_price(uuid, uuid, uuid, bigint, text, uuid) is
  'Ajuste atômico e auditado do total de um item antes do pagamento; executável somente pela service_role no backend.';
