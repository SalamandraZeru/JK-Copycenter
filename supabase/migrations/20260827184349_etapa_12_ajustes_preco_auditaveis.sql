begin;

-- O valor comercial pode mudar antes do pagamento, mas a base calculada no
-- checkout não pode ser reescrita. A versão torna conflitos entre operadores
-- explícitos, em vez de permitir uma gravação silenciosa sobre outra.
alter table public.orders
  add column if not exists original_subtotal_cents bigint,
  add column if not exists original_total_cents bigint,
  add column if not exists price_version integer not null default 1;

alter table public.order_items
  add column if not exists original_total_price_cents bigint;

alter table public.order_price_adjustments
  add column if not exists order_version_before integer,
  add column if not exists order_version_after integer;

with first_adjustment as (
  select distinct on (order_id)
    order_id,
    previous_order_subtotal_cents,
    previous_order_total_cents
  from public.order_price_adjustments
  order by order_id, created_at asc, id asc
)
update public.orders as order_row
set original_subtotal_cents = coalesce(first_adjustment.previous_order_subtotal_cents, order_row.subtotal_cents),
    original_total_cents = coalesce(first_adjustment.previous_order_total_cents, order_row.total_cents)
from first_adjustment
where order_row.id = first_adjustment.order_id
  and (order_row.original_subtotal_cents is null or order_row.original_total_cents is null);

update public.orders
set original_subtotal_cents = subtotal_cents,
    original_total_cents = total_cents
where original_subtotal_cents is null or original_total_cents is null;

with first_item_adjustment as (
  select distinct on (order_item_id)
    order_item_id,
    previous_item_total_cents
  from public.order_price_adjustments
  order by order_item_id, created_at asc, id asc
)
update public.order_items as item
set original_total_price_cents = coalesce(first_item_adjustment.previous_item_total_cents, item.total_price_cents)
from first_item_adjustment
where item.id = first_item_adjustment.order_item_id
  and item.original_total_price_cents is null;

update public.order_items
set original_total_price_cents = total_price_cents
where original_total_price_cents is null;

with numbered_adjustments as (
  select id, row_number() over (partition by order_id order by created_at asc, id asc) as adjustment_number
  from public.order_price_adjustments
)
update public.order_price_adjustments as adjustment
set order_version_before = numbered_adjustments.adjustment_number::integer,
    order_version_after = (numbered_adjustments.adjustment_number + 1)::integer
from numbered_adjustments
where adjustment.id = numbered_adjustments.id
  and (adjustment.order_version_before is null or adjustment.order_version_after is null);

update public.orders as order_row
set price_version = coalesce((
  select max(adjustment.order_version_after)
  from public.order_price_adjustments as adjustment
  where adjustment.order_id = order_row.id
), 1)
where price_version < coalesce((
  select max(adjustment.order_version_after)
  from public.order_price_adjustments as adjustment
  where adjustment.order_id = order_row.id
), 1);

alter table public.orders
  alter column original_subtotal_cents set not null,
  alter column original_total_cents set not null,
  add constraint orders_original_price_nonnegative
    check (original_subtotal_cents >= 0 and original_total_cents >= 0 and price_version >= 1) not valid;
alter table public.orders validate constraint orders_original_price_nonnegative;

alter table public.order_items
  alter column original_total_price_cents set not null,
  add constraint order_items_original_total_price_nonnegative
    check (original_total_price_cents >= 0) not valid;
alter table public.order_items validate constraint order_items_original_total_price_nonnegative;

alter table public.order_price_adjustments
  alter column order_version_before set not null,
  alter column order_version_after set not null,
  add constraint order_price_adjustments_version_check
    check (order_version_before >= 1 and order_version_after = order_version_before + 1) not valid;
alter table public.order_price_adjustments validate constraint order_price_adjustments_version_check;

create or replace function private.capture_initial_order_price_baseline()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.original_subtotal_cents := coalesce(new.original_subtotal_cents, new.subtotal_cents);
  new.original_total_cents := coalesce(new.original_total_cents, new.total_cents);
  new.price_version := coalesce(new.price_version, 1);
  return new;
end;
$$;

create or replace function private.capture_initial_order_item_price_baseline()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.original_total_price_cents := coalesce(new.original_total_price_cents, new.total_price_cents);
  return new;
end;
$$;

revoke all on function private.capture_initial_order_price_baseline() from public, anon, authenticated, service_role;
revoke all on function private.capture_initial_order_item_price_baseline() from public, anon, authenticated, service_role;
drop trigger if exists trg_capture_initial_order_price_baseline on public.orders;
create trigger trg_capture_initial_order_price_baseline
before insert on public.orders
for each row execute function private.capture_initial_order_price_baseline();
drop trigger if exists trg_capture_initial_order_item_price_baseline on public.order_items;
create trigger trg_capture_initial_order_item_price_baseline
before insert on public.order_items
for each row execute function private.capture_initial_order_item_price_baseline();

create or replace function private.prevent_order_price_adjustment_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'ORDER_PRICE_ADJUSTMENT_IMMUTABLE';
end;
$$;

revoke all on function private.prevent_order_price_adjustment_mutation() from public, anon, authenticated, service_role;
drop trigger if exists trg_prevent_order_price_adjustment_mutation on public.order_price_adjustments;
create trigger trg_prevent_order_price_adjustment_mutation
before update or delete on public.order_price_adjustments
for each row execute function private.prevent_order_price_adjustment_mutation();

-- O histórico é visível ao proprietário autenticado, mas só o backend de
-- serviço autorizado insere registros. Nenhum outro cliente recebe o nome do
-- operador a partir dessa política.
grant select on table public.order_price_adjustments to authenticated;
drop policy if exists order_price_adjustments_customer_read on public.order_price_adjustments;
create policy order_price_adjustments_customer_read
  on public.order_price_adjustments for select to authenticated
  using (exists (
    select 1 from public.orders as order_row
    where order_row.id = order_price_adjustments.order_id
      and order_row.user_id = (select auth.uid())
  ));

alter function public.adjust_order_item_price(uuid, uuid, uuid, bigint, text, uuid)
  rename to adjust_order_item_price_legacy;
alter function public.adjust_order_item_price_legacy(uuid, uuid, uuid, bigint, text, uuid)
  set schema private;
revoke all on function private.adjust_order_item_price_legacy(uuid, uuid, uuid, bigint, text, uuid)
  from public, anon, authenticated, service_role;

create function public.adjust_order_item_price(
  p_order_id uuid,
  p_order_item_id uuid,
  p_admin_user_id uuid,
  p_new_total_cents bigint,
  p_reason text,
  p_idempotency_key uuid,
  p_expected_order_version integer
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
  if p_expected_order_version is null or p_expected_order_version < 1 then
    raise exception using errcode = '22023', message = 'ORDER_PRICE_VERSION_INVALID';
  end if;
  if nullif(btrim(p_reason), '') is null or char_length(btrim(p_reason)) < 3 or char_length(btrim(p_reason)) > 2000 then
    raise exception using errcode = '22023', message = 'ORDER_PRICE_REASON_REQUIRED';
  end if;

  perform 1 from public.admin_users as admin_user
  where admin_user.id = p_admin_user_id and admin_user.is_active;
  if not found then
    raise exception using errcode = '42501', message = 'ORDER_PRICE_ACTOR_INVALID';
  end if;

  select adjustment.* into v_existing
  from public.order_price_adjustments as adjustment
  where adjustment.order_id = p_order_id and adjustment.idempotency_key = p_idempotency_key
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
  if v_order.price_version <> p_expected_order_version then
    raise exception using errcode = '40001', message = 'ORDER_PRICE_VERSION_CONFLICT';
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
      unit_price_cents = p_new_total_cents / greatest(order_item.quantity, 1),
      total_price = p_new_total_cents::numeric / 100,
      unit_price = round((p_new_total_cents::numeric / greatest(order_item.quantity, 1)) / 100, 4)
  where order_item.id = v_item.id;

  update public.orders as placed_order
  set subtotal_cents = v_new_subtotal_cents,
      total_cents = v_new_total_cents,
      subtotal = v_new_subtotal_cents::numeric / 100,
      total = v_new_total_cents::numeric / 100,
      price_version = v_order.price_version + 1,
      updated_at = now()
  where placed_order.id = v_order.id;

  insert into public.order_price_adjustments (
    order_id, order_item_id, admin_user_id, idempotency_key,
    previous_item_total_cents, new_item_total_cents,
    previous_order_subtotal_cents, new_order_subtotal_cents,
    previous_order_total_cents, new_order_total_cents,
    reason, order_version_before, order_version_after
  ) values (
    v_order.id, v_item.id, p_admin_user_id, p_idempotency_key,
    v_item.total_price_cents, p_new_total_cents,
    v_order.subtotal_cents, v_new_subtotal_cents,
    v_order.total_cents, v_new_total_cents,
    btrim(p_reason), v_order.price_version, v_order.price_version + 1
  );

  insert into public.audit_logs (admin_user_id, action, entity, entity_id, old_value, new_value)
  values (
    p_admin_user_id, 'adjust_order_item_price', 'orders', v_order.id,
    jsonb_build_object('price_version', v_order.price_version, 'item_total_cents', v_item.total_price_cents, 'subtotal_cents', v_order.subtotal_cents, 'total_cents', v_order.total_cents),
    jsonb_build_object('price_version', v_order.price_version + 1, 'item_total_cents', p_new_total_cents, 'subtotal_cents', v_new_subtotal_cents, 'total_cents', v_new_total_cents, 'reason', btrim(p_reason))
  );

  return query select v_order.id, v_new_subtotal_cents, v_new_total_cents, false;
end;
$$;

revoke all on function public.adjust_order_item_price(uuid, uuid, uuid, bigint, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.adjust_order_item_price(uuid, uuid, uuid, bigint, text, uuid, integer)
  to service_role;

comment on column public.orders.original_total_cents is 'Total calculado no checkout, preservado como referência imutável antes de ajustes administrativos.';
comment on column public.orders.price_version is 'Versão comercial do pedido; evita ajustes concorrentes silenciosos.';
comment on column public.order_items.original_total_price_cents is 'Total calculado originalmente para o item, preservado mesmo após ajustes comerciais.';
comment on table public.order_price_adjustments is 'Histórico imutável e versionado dos ajustes finais de preço antes do pagamento.';

commit;
