begin;

-- Categories are a stationery concern. Graphic services are configured through
-- dynamic service fields and must never leak into the product-category filter.
alter table public.categories
  add column if not exists catalog_scope text not null default 'stationery',
  add constraint categories_catalog_scope_check
    check (catalog_scope = 'stationery') not valid;
alter table public.categories validate constraint categories_catalog_scope_check;

create or replace function private.reject_service_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category_id is not null then
    raise exception using errcode = '22023', message = 'SERVICE_CATEGORY_NOT_SUPPORTED';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_service_category() from public, anon, authenticated, service_role;
drop trigger if exists trg_services_without_product_category on public.services;
create trigger trg_services_without_product_category
before insert or update of category_id on public.services
for each row execute function private.reject_service_category();

create or replace function public.replace_product_categories(
  p_product_id uuid,
  p_category_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_ids uuid[];
  v_existing_categories integer;
begin
  if not exists (select 1 from public.products where id = p_product_id and deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'PRODUCT_NOT_FOUND';
  end if;

  select coalesce(array_agg(distinct category_id order by category_id), '{}'::uuid[])
  into v_category_ids
  from unnest(coalesce(p_category_ids, '{}'::uuid[])) as input(category_id);

  select count(*)::integer
  into v_existing_categories
  from public.categories
  where id = any(v_category_ids) and catalog_scope = 'stationery';

  if v_existing_categories <> cardinality(v_category_ids) then
    raise exception using errcode = '22023', message = 'INVALID_PRODUCT_CATEGORY';
  end if;

  delete from public.product_categories where product_id = p_product_id;
  insert into public.product_categories (product_id, category_id)
  select p_product_id, category_id from unnest(v_category_ids) as input(category_id);
  update public.products set category_id = v_category_ids[1] where id = p_product_id;
end;
$$;

revoke all on function public.replace_product_categories(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.replace_product_categories(uuid, uuid[]) to service_role;

-- No commercial value is invented here. SKU and the customer-facing unit are
-- deliberately nullable for the existing catalog and mandatory for future
-- edits through the administrative API.
alter table public.products
  add column if not exists sku text,
  add column if not exists unit_label text,
  add column if not exists package_quantity integer not null default 1,
  add column if not exists stock_control_enabled boolean not null default false,
  add column if not exists reserved_quantity integer not null default 0;

update public.products
set stock_control_enabled = stock_quantity is not null
where stock_control_enabled = false and stock_quantity is not null;

alter table public.products
  add constraint products_sku_format_check
    check (sku is null or sku ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$') not valid,
  add constraint products_unit_label_check
    check (unit_label is null or char_length(btrim(unit_label)) between 1 and 40) not valid,
  add constraint products_package_quantity_check
    check (package_quantity between 1 and 100000000) not valid,
  add constraint products_stock_control_check
    check (
      (not stock_control_enabled and reserved_quantity = 0)
      or (stock_control_enabled and stock_quantity is not null and reserved_quantity between 0 and stock_quantity)
    ) not valid;
alter table public.products validate constraint products_sku_format_check;
alter table public.products validate constraint products_unit_label_check;
alter table public.products validate constraint products_package_quantity_check;
alter table public.products validate constraint products_stock_control_check;

create unique index if not exists products_sku_active_unique
  on public.products (lower(sku))
  where sku is not null and deleted_at is null;
create index if not exists products_catalog_search_idx
  on public.products (is_active, sort_order, name)
  where deleted_at is null;

create table if not exists public.product_inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'active' check (status in ('active', 'released', 'consumed')),
  reason text,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);

create unique index if not exists product_inventory_reservations_order_product_unique
  on public.product_inventory_reservations(order_id, product_id);
create index if not exists product_inventory_reservations_active_product_idx
  on public.product_inventory_reservations(product_id)
  where status = 'active';

alter table public.product_inventory_reservations enable row level security;
revoke all on table public.product_inventory_reservations from public, anon, authenticated;
grant all on table public.product_inventory_reservations to service_role;

create or replace function private.assert_product_stock_available(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product record;
begin
  for v_product in
    select
      (item.value ->> 'product_id')::uuid as product_id,
      sum((item.value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as item(value)
    where nullif(item.value ->> 'product_id', '') is not null
    group by (item.value ->> 'product_id')::uuid
    order by (item.value ->> 'product_id')::uuid
  loop
    perform 1
    from public.products product
    where product.id = v_product.product_id
      and product.is_active
      and product.deleted_at is null
    for update;
    if not found then
      raise exception using errcode = '22023', message = 'PRODUCT_UNAVAILABLE';
    end if;

    if exists (
      select 1 from public.products product
      where product.id = v_product.product_id
        and product.stock_control_enabled
        and (product.stock_quantity is null or product.stock_quantity - product.reserved_quantity < v_product.quantity)
    ) then
      raise exception using errcode = 'P0001', message = 'STOCK_UNAVAILABLE';
    end if;
  end loop;
end;
$$;

create or replace function private.reserve_product_stock(p_order_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product record;
begin
  for v_product in
    select
      (item.value ->> 'product_id')::uuid as product_id,
      sum((item.value ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) as item(value)
    where nullif(item.value ->> 'product_id', '') is not null
    group by (item.value ->> 'product_id')::uuid
    order by (item.value ->> 'product_id')::uuid
  loop
    update public.products product
    set reserved_quantity = product.reserved_quantity + v_product.quantity
    where product.id = v_product.product_id
      and product.stock_control_enabled
      and product.stock_quantity is not null
      and product.stock_quantity - product.reserved_quantity >= v_product.quantity;

    if found then
      insert into public.product_inventory_reservations(order_id, product_id, quantity, status, reason)
      values (p_order_id, v_product.product_id, v_product.quantity, 'active', 'Reserva criada no checkout transacional');
    elsif exists (
      select 1 from public.products product
      where product.id = v_product.product_id and product.stock_control_enabled
    ) then
      raise exception using errcode = 'P0001', message = 'STOCK_UNAVAILABLE';
    end if;
  end loop;
end;
$$;

create or replace function private.release_product_stock_reservations(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.product_inventory_reservations%rowtype;
begin
  for v_reservation in
    select * from public.product_inventory_reservations
    where order_id = p_order_id and status = 'active'
    order by product_id
    for update
  loop
    update public.products product
    set reserved_quantity = product.reserved_quantity - v_reservation.quantity
    where product.id = v_reservation.product_id
      and product.reserved_quantity >= v_reservation.quantity;
    if not found then
      raise exception using errcode = 'P0001', message = 'STOCK_RESERVATION_INTEGRITY_ERROR';
    end if;
    update public.product_inventory_reservations
    set status = 'released', reason = left(coalesce(nullif(btrim(p_reason), ''), 'Reserva liberada'), 500), finalized_at = now()
    where id = v_reservation.id;
  end loop;
end;
$$;

create or replace function private.consume_product_stock_reservations(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.product_inventory_reservations%rowtype;
begin
  for v_reservation in
    select * from public.product_inventory_reservations
    where order_id = p_order_id and status = 'active'
    order by product_id
    for update
  loop
    update public.products product
    set
      stock_quantity = product.stock_quantity - v_reservation.quantity,
      reserved_quantity = product.reserved_quantity - v_reservation.quantity
    where product.id = v_reservation.product_id
      and product.stock_control_enabled
      and product.stock_quantity is not null
      and product.stock_quantity >= v_reservation.quantity
      and product.reserved_quantity >= v_reservation.quantity;
    if not found then
      raise exception using errcode = 'P0001', message = 'STOCK_RESERVATION_INTEGRITY_ERROR';
    end if;
    update public.product_inventory_reservations
    set status = 'consumed', reason = left(coalesce(nullif(btrim(p_reason), ''), 'Estoque baixado após confirmação'), 500), finalized_at = now()
    where id = v_reservation.id;
  end loop;
end;
$$;

revoke all on function private.assert_product_stock_available(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.reserve_product_stock(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.release_product_stock_reservations(uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.consume_product_stock_reservations(uuid, text) from public, anon, authenticated, service_role;

-- Keep the already audited checkout implementation intact and wrap it with
-- product-row locking plus an inventory reservation in the same transaction.
alter function public.commit_checkout(uuid, text, uuid, text, text, jsonb, jsonb, uuid[])
  rename to commit_checkout_core;
alter function public.commit_checkout_core(uuid, text, uuid, text, text, jsonb, jsonb, uuid[])
  set schema private;
revoke all on function private.commit_checkout_core(uuid, text, uuid, text, text, jsonb, jsonb, uuid[])
  from public, anon, authenticated, service_role;

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
  v_result record;
begin
  perform private.assert_product_stock_available(p_items);
  select * into v_result from private.commit_checkout_core(
    p_idempotency_key, p_request_hash, p_user_id, p_guest_email, p_guest_upload_session_hash, p_order, p_items, p_file_ids
  );
  if not v_result.replayed then
    perform private.reserve_product_stock(v_result.order_id, p_items);
  end if;
  return query select v_result.order_id, v_result.order_number, v_result.order_code, v_result.total_cents, v_result.payment_method, v_result.replayed;
end;
$$;

alter function public.process_manual_payment(uuid, uuid, text, text, text, uuid)
  rename to process_manual_payment_core;
alter function public.process_manual_payment_core(uuid, uuid, text, text, text, uuid)
  set schema private;
revoke all on function private.process_manual_payment_core(uuid, uuid, text, text, text, uuid)
  from public, anon, authenticated, service_role;

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
  v_result record;
begin
  select * into v_result from private.process_manual_payment_core(
    p_order_id, p_admin_user_id, p_action, p_note, p_external_reference, p_idempotency_key
  );
  if not v_result.replayed then
    if p_action = 'paid' then
      perform private.consume_product_stock_reservations(v_result.order_id, p_note);
    else
      perform private.release_product_stock_reservations(v_result.order_id, p_note);
    end if;
  end if;
  return query select v_result.order_id, v_result.order_status, v_result.payment_status, v_result.replayed;
end;
$$;

alter function public.transition_order_status(uuid, uuid, public.order_status, text, uuid, boolean)
  rename to transition_order_status_core;
alter function public.transition_order_status_core(uuid, uuid, public.order_status, text, uuid, boolean)
  set schema private;
revoke all on function private.transition_order_status_core(uuid, uuid, public.order_status, text, uuid, boolean)
  from public, anon, authenticated, service_role;

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
  v_result record;
begin
  select * into v_result from private.transition_order_status_core(
    p_order_id, p_admin_user_id, p_to_status, p_note, p_idempotency_key, p_allow_unpaid_confirmation
  );
  if not v_result.replayed and p_to_status = 'cancelled' then
    perform private.release_product_stock_reservations(v_result.order_id, p_note);
  end if;
  return query select v_result.order_id, v_result.order_status, v_result.replayed;
end;
$$;

revoke all on function public.commit_checkout(uuid, text, uuid, text, text, jsonb, jsonb, uuid[]) from public, anon, authenticated;
grant execute on function public.commit_checkout(uuid, text, uuid, text, text, jsonb, jsonb, uuid[]) to service_role;
revoke all on function public.process_manual_payment(uuid, uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.process_manual_payment(uuid, uuid, text, text, text, uuid) to service_role;
revoke all on function public.transition_order_status(uuid, uuid, public.order_status, text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.transition_order_status(uuid, uuid, public.order_status, text, uuid, boolean) to service_role;

comment on column public.products.sku is 'SKU comercial configurado pelo administrador; único entre produtos não excluídos.';
comment on column public.products.unit_label is 'Unidade comercial de venda configurada pelo administrador, por exemplo unidade, pacote ou caixa.';
comment on column public.products.package_quantity is 'Quantidade de unidades físicas representadas por uma unidade de venda.';
comment on column public.products.reserved_quantity is 'Saldo temporariamente reservado por pedidos aguardando confirmação.';
comment on table public.product_inventory_reservations is 'Reservas transacionais de estoque de papelaria; o checkout não pode vender além do saldo disponível.';

commit;
