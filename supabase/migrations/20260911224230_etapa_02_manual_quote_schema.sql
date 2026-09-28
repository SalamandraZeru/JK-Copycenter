begin;

-- Etapa 2: contrato aditivo para separar compra de papelaria, solicitação de
-- orçamento gráfico e checkout legado. O fluxo legado permanece operacional
-- enquanto SERVICE_MANUAL_QUOTE_ENABLED estiver desligada.

create type public.order_kind as enum (
  'legacy_checkout',
  'stationery_sale',
  'graphic_quote'
);

create type public.order_quote_status as enum (
  'not_applicable',
  'pending',
  'negotiating',
  'quoted',
  'accepted',
  'declined',
  'expired',
  'cancelled'
);

create type public.order_quote_event_type as enum (
  'issued',
  'revised',
  'accepted',
  'declined',
  'expired',
  'cancelled'
);

create type public.order_quote_actor_type as enum (
  'admin',
  'customer_authenticated',
  'customer_guest',
  'system'
);

create type public.service_commercial_mode as enum (
  'automatic_pricing',
  'manual_quote'
);

alter table public.services
  add column commercial_mode public.service_commercial_mode not null default 'manual_quote';

comment on column public.services.commercial_mode is
  'Modo comercial explícito. Serviços gráficos novos usam orçamento manual; automatic_pricing existe apenas para compatibilidade controlada.';

-- Pedidos já existentes recebem a classificação técnica legacy_checkout. Isso
-- evita declarar falsamente que um preço automático antigo foi um orçamento
-- manual aceito pelo cliente.
alter table public.orders
  add column order_kind public.order_kind not null default 'legacy_checkout',
  add column quote_status public.order_quote_status not null default 'not_applicable',
  add column latest_quote_version integer not null default 0,
  add column quoted_at timestamptz,
  add column quote_expires_at timestamptz,
  add column accepted_at timestamptz,
  add column accepted_quote_id uuid;

-- Uma solicitação gráfica não escolhe forma de pagamento antes do aceite.
-- O checkout legado continua enviando esse campo e preserva o comportamento.
alter table public.orders
  alter column payment_method drop not null;

alter table public.orders
  add constraint orders_latest_quote_version_nonnegative
    check (latest_quote_version >= 0) not valid,
  add constraint orders_payment_method_by_kind
    check (order_kind = 'graphic_quote' or payment_method is not null) not valid,
  add constraint orders_quote_expiry_valid
    check (
      quote_expires_at is null
      or (quoted_at is not null and quote_expires_at > quoted_at)
    ) not valid,
  add constraint orders_commercial_state_valid
    check (
      (
        order_kind in ('legacy_checkout', 'stationery_sale')
        and quote_status = 'not_applicable'
        and latest_quote_version = 0
        and quoted_at is null
        and quote_expires_at is null
        and accepted_at is null
        and accepted_quote_id is null
      )
      or
      (
        order_kind = 'graphic_quote'
        and quote_status <> 'not_applicable'
        and (
          (
            quote_status in ('pending', 'negotiating')
            and latest_quote_version = 0
            and quoted_at is null
            and quote_expires_at is null
            and accepted_at is null
            and accepted_quote_id is null
          )
          or
          (
            quote_status = 'quoted'
            and latest_quote_version >= 1
            and quoted_at is not null
            and accepted_at is null
            and accepted_quote_id is null
          )
          or
          (
            quote_status = 'accepted'
            and latest_quote_version >= 1
            and quoted_at is not null
            and accepted_at is not null
            and accepted_quote_id is not null
            and subtotal_cents > 0
            and total_cents > 0
          )
          or
          (
            quote_status in ('declined', 'expired')
            and latest_quote_version >= 1
            and quoted_at is not null
            and accepted_at is null
            and accepted_quote_id is null
            and subtotal_cents = 0
            and delivery_fee_cents = 0
            and total_cents = 0
          )
          or
          (
            quote_status = 'cancelled'
            and accepted_at is null
            and accepted_quote_id is null
            and subtotal_cents = 0
            and delivery_fee_cents = 0
            and total_cents = 0
          )
        )
      )
    ) not valid,
  add constraint orders_stationery_sale_has_price
    check (
      order_kind <> 'stationery_sale'
      or (original_subtotal_cents > 0 and original_total_cents > 0)
    ) not valid;

alter table public.orders validate constraint orders_latest_quote_version_nonnegative;
alter table public.orders validate constraint orders_payment_method_by_kind;
alter table public.orders validate constraint orders_quote_expiry_valid;
alter table public.orders validate constraint orders_commercial_state_valid;
alter table public.orders validate constraint orders_stationery_sale_has_price;

create table public.admin_role_capabilities (
  role public.admin_role primary key,
  can_manage_quotes boolean not null default false,
  can_confirm_payments boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.admin_role_capabilities (
  role,
  can_manage_quotes,
  can_confirm_payments
) values
  ('super_admin', true, true),
  ('admin', true, true),
  ('producao', false, false),
  ('catalogo', false, false);

comment on table public.admin_role_capabilities is
  'Permissões comerciais independentes: emitir/revisar orçamento não implica confirmar pagamento e vice-versa.';

create table public.order_quotes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  version integer not null,
  subtotal_cents bigint not null,
  delivery_fee_cents bigint not null default 0,
  total_cents bigint not null,
  commercial_observation text not null,
  change_reason text,
  expires_at timestamptz not null,
  created_by uuid references public.admin_users(id) on delete set null,
  idempotency_key uuid not null,
  request_hash text not null,
  created_at timestamptz not null default now(),

  constraint order_quotes_version_positive check (version >= 1),
  constraint order_quotes_amounts_valid check (
    subtotal_cents > 0
    and delivery_fee_cents >= 0
    and total_cents = subtotal_cents + delivery_fee_cents
    and total_cents <= 100000000
  ),
  constraint order_quotes_observation_valid check (
    char_length(btrim(commercial_observation)) between 3 and 4000
  ),
  constraint order_quotes_change_reason_valid check (
    change_reason is null
    or char_length(btrim(change_reason)) between 3 and 2000
  ),
  constraint order_quotes_request_hash_format check (request_hash ~ '^[a-f0-9]{64}$'),
  constraint order_quotes_order_version_unique unique (order_id, version),
  constraint order_quotes_order_idempotency_unique unique (order_id, idempotency_key)
);

create table public.order_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.order_quotes(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  line_position integer not null,
  label_snapshot text not null,
  quantity integer not null,
  unit_price_cents bigint not null,
  total_price_cents bigint not null,
  scope_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint order_quote_items_position_positive check (line_position >= 1),
  constraint order_quote_items_label_valid check (
    char_length(btrim(label_snapshot)) between 1 and 300
  ),
  constraint order_quote_items_quantity_positive check (quantity >= 1),
  constraint order_quote_items_amounts_valid check (
    unit_price_cents >= 0
    and total_price_cents = unit_price_cents * quantity
    and total_price_cents <= 100000000
  ),
  constraint order_quote_items_scope_object check (jsonb_typeof(scope_snapshot) = 'object'),
  constraint order_quote_items_quote_item_unique unique (quote_id, order_item_id),
  constraint order_quote_items_quote_position_unique unique (quote_id, line_position)
);

create table public.order_quote_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  quote_id uuid references public.order_quotes(id) on delete cascade,
  event_type public.order_quote_event_type not null,
  actor_type public.order_quote_actor_type not null,
  admin_user_id uuid references public.admin_users(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  idempotency_key uuid not null,
  request_hash text not null,
  note text,
  created_at timestamptz not null default now(),

  constraint order_quote_events_actor_valid check (
    (actor_type = 'admin' and actor_user_id is null)
    or (actor_type = 'customer_authenticated' and admin_user_id is null)
    or (actor_type in ('customer_guest', 'system') and admin_user_id is null and actor_user_id is null)
  ),
  constraint order_quote_events_request_hash_format check (request_hash ~ '^[a-f0-9]{64}$'),
  constraint order_quote_events_note_valid check (
    note is null or char_length(btrim(note)) between 3 and 2000
  ),
  constraint order_quote_events_order_idempotency_unique unique (order_id, idempotency_key)
);

alter table public.orders
  add constraint orders_accepted_quote_id_fkey
  foreign key (accepted_quote_id) references public.order_quotes(id) on delete restrict;

create index order_quotes_order_created_idx
  on public.order_quotes (order_id, created_at desc);
create index order_quotes_created_by_idx
  on public.order_quotes (created_by);
create index order_quote_items_order_item_idx
  on public.order_quote_items (order_item_id);
create index order_quote_events_order_created_idx
  on public.order_quote_events (order_id, created_at desc);
create index order_quote_events_quote_id_idx
  on public.order_quote_events (quote_id);
create index order_quote_events_admin_user_id_idx
  on public.order_quote_events (admin_user_id);
create index order_quote_events_actor_user_id_idx
  on public.order_quote_events (actor_user_id);
create index orders_graphic_quote_queue_idx
  on public.orders (quote_status, created_at desc)
  where order_kind = 'graphic_quote'
    and quote_status in ('pending', 'negotiating', 'quoted');
create index services_commercial_mode_active_idx
  on public.services (commercial_mode, sort_order, id)
  where is_active and deleted_at is null;

-- Índices de FKs existentes apontados pelo advisor. São aditivos e evitam
-- varreduras completas em JOINs e ações referenciais.
create index if not exists order_artwork_approvals_approved_by_user_id_idx
  on public.order_artwork_approvals (approved_by_user_id);
create index if not exists order_artwork_approvals_order_file_id_idx
  on public.order_artwork_approvals (order_file_id);
create index if not exists order_artwork_approvals_order_id_idx
  on public.order_artwork_approvals (order_id);
create index if not exists order_file_preflight_reports_order_item_id_idx
  on public.order_file_preflight_reports (order_item_id);
create index if not exists order_file_preflight_reports_reviewed_by_idx
  on public.order_file_preflight_reports (reviewed_by);
create index if not exists order_price_adjustments_admin_user_id_idx
  on public.order_price_adjustments (admin_user_id);
create index if not exists order_price_adjustments_order_item_id_idx
  on public.order_price_adjustments (order_item_id);
create index if not exists order_status_communications_admin_user_id_idx
  on public.order_status_communications (admin_user_id);
create index if not exists service_catalog_versions_changed_by_idx
  on public.service_catalog_versions (changed_by);
create index if not exists service_field_option_dependencies_source_field_id_idx
  on public.service_field_option_dependencies (source_field_id);
create index if not exists service_field_option_dependencies_target_field_id_idx
  on public.service_field_option_dependencies (target_field_id);
create index if not exists services_catalog_updated_by_idx
  on public.services (catalog_updated_by);

-- Evita reavaliar auth.uid() a cada linha nas duas políticas legadas.
drop policy if exists order_file_preflight_reports_customer_read on public.order_file_preflight_reports;
create policy order_file_preflight_reports_customer_read
  on public.order_file_preflight_reports for select to authenticated
  using (exists (
    select 1 from public.orders as order_row
    where order_row.id = order_file_preflight_reports.order_id
      and order_row.user_id = (select auth.uid())
  ));

drop policy if exists order_artwork_approvals_customer_read on public.order_artwork_approvals;
create policy order_artwork_approvals_customer_read
  on public.order_artwork_approvals for select to authenticated
  using (exists (
    select 1 from public.orders as order_row
    where order_row.id = order_artwork_approvals.order_id
      and order_row.user_id = (select auth.uid())
  ));

alter table public.admin_role_capabilities enable row level security;
alter table public.order_quotes enable row level security;
alter table public.order_quote_items enable row level security;
alter table public.order_quote_events enable row level security;

revoke all on table public.admin_role_capabilities, public.order_quotes,
  public.order_quote_items, public.order_quote_events
  from public, anon, authenticated;
grant all on table public.admin_role_capabilities, public.order_quotes,
  public.order_quote_items, public.order_quote_events
  to service_role;
grant select on table public.order_quotes, public.order_quote_items,
  public.order_quote_events
  to authenticated;

create policy order_quotes_customer_read
  on public.order_quotes for select to authenticated
  using (exists (
    select 1 from public.orders as order_row
    where order_row.id = order_quotes.order_id
      and order_row.user_id = (select auth.uid())
  ));

create policy order_quote_items_customer_read
  on public.order_quote_items for select to authenticated
  using (exists (
    select 1
    from public.order_quotes as quote_row
    join public.orders as order_row on order_row.id = quote_row.order_id
    where quote_row.id = order_quote_items.quote_id
      and order_row.user_id = (select auth.uid())
  ));

create policy order_quote_events_customer_read
  on public.order_quote_events for select to authenticated
  using (exists (
    select 1 from public.orders as order_row
    where order_row.id = order_quote_events.order_id
      and order_row.user_id = (select auth.uid())
  ));

create or replace function private.admin_has_commercial_capability(
  p_admin_user_id uuid,
  p_capability text
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users as admin_user
    join public.admin_role_capabilities as capability
      on capability.role = admin_user.role
    where admin_user.id = p_admin_user_id
      and admin_user.is_active
      and case p_capability
        when 'manage_quotes' then capability.can_manage_quotes
        when 'confirm_payments' then capability.can_confirm_payments
        else false
      end
  );
$$;

create or replace function private.enforce_payment_capability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.admin_has_commercial_capability(new.admin_user_id, 'confirm_payments') then
    raise exception using errcode = '42501', message = 'PAYMENT_ACTOR_NOT_AUTHORIZED';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_payment_capability on public.order_payment_events;
create trigger trg_enforce_payment_capability
before insert on public.order_payment_events
for each row execute function private.enforce_payment_capability();

create or replace function private.preserve_quote_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'ORDER_QUOTE_HISTORY_IMMUTABLE';
  end if;

  -- FKs com ON DELETE SET NULL podem anonimizar o autor sem reescrever o
  -- conteúdo comercial ou o evento histórico.
  if tg_table_name = 'order_quotes'
     and (to_jsonb(new) ->> 'created_by') is null
     and (to_jsonb(old) ->> 'created_by') is not null
     and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by') then
    return new;
  end if;

  if tg_table_name = 'order_quote_events'
     and (
       (to_jsonb(new) ->> 'admin_user_id') is null
       or (to_jsonb(new) ->> 'admin_user_id') is not distinct from (to_jsonb(old) ->> 'admin_user_id')
     )
     and (
       (to_jsonb(new) ->> 'actor_user_id') is null
       or (to_jsonb(new) ->> 'actor_user_id') is not distinct from (to_jsonb(old) ->> 'actor_user_id')
     )
     and (to_jsonb(new) - 'admin_user_id' - 'actor_user_id') =
         (to_jsonb(old) - 'admin_user_id' - 'actor_user_id') then
    return new;
  end if;

  raise exception using errcode = '55000', message = 'ORDER_QUOTE_HISTORY_IMMUTABLE';
end;
$$;

create trigger trg_preserve_order_quotes
before update or delete on public.order_quotes
for each row execute function private.preserve_quote_history();
create trigger trg_preserve_order_quote_items
before update or delete on public.order_quote_items
for each row execute function private.preserve_quote_history();
create trigger trg_preserve_order_quote_events
before update or delete on public.order_quote_events
for each row execute function private.preserve_quote_history();

create or replace function private.prevent_graphic_quote_price_bypass()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_kind public.order_kind;
begin
  if tg_table_name = 'orders' then
    v_order_id := (to_jsonb(new) ->> 'id')::uuid;
  else
    v_order_id := (to_jsonb(new) ->> 'order_id')::uuid;
  end if;

  if tg_table_name = 'orders' then
    v_order_kind := (to_jsonb(new) ->> 'order_kind')::public.order_kind;
  else
    select order_row.order_kind into v_order_kind
    from public.orders as order_row
    where order_row.id = v_order_id;
  end if;

  if v_order_kind = 'graphic_quote'
     and coalesce(current_setting('app.accepting_quote_order_id', true), '') <> v_order_id::text then
    raise exception using errcode = '42501', message = 'GRAPHIC_QUOTE_PRICE_REQUIRES_ACCEPTED_VERSION';
  end if;

  return new;
end;
$$;

create trigger trg_prevent_graphic_quote_order_price_bypass
before update of delivery_fee, subtotal, total, delivery_fee_cents,
  subtotal_cents, total_cents, original_subtotal_cents, original_total_cents,
  price_version
on public.orders
for each row
when (
  old.delivery_fee is distinct from new.delivery_fee
  or old.subtotal is distinct from new.subtotal
  or old.total is distinct from new.total
  or old.delivery_fee_cents is distinct from new.delivery_fee_cents
  or old.subtotal_cents is distinct from new.subtotal_cents
  or old.total_cents is distinct from new.total_cents
  or old.original_subtotal_cents is distinct from new.original_subtotal_cents
  or old.original_total_cents is distinct from new.original_total_cents
  or old.price_version is distinct from new.price_version
)
execute function private.prevent_graphic_quote_price_bypass();

create trigger trg_prevent_graphic_quote_item_price_bypass
before update of unit_price, total_price, unit_price_cents, total_price_cents,
  original_total_price_cents, discount_cents, discount_applied,
  pricing_rule_id, pricing_rule_snapshot
on public.order_items
for each row
when (
  old.unit_price is distinct from new.unit_price
  or old.total_price is distinct from new.total_price
  or old.unit_price_cents is distinct from new.unit_price_cents
  or old.total_price_cents is distinct from new.total_price_cents
  or old.original_total_price_cents is distinct from new.original_total_price_cents
  or old.discount_cents is distinct from new.discount_cents
  or old.discount_applied is distinct from new.discount_applied
  or old.pricing_rule_id is distinct from new.pricing_rule_id
  or old.pricing_rule_snapshot is distinct from new.pricing_rule_snapshot
)
execute function private.prevent_graphic_quote_price_bypass();

create or replace function private.create_order_quote_version(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_expected_quote_version integer,
  p_idempotency_key uuid,
  p_request_hash text,
  p_commercial_observation text,
  p_change_reason text,
  p_expires_at timestamptz,
  p_delivery_fee_cents bigint,
  p_items jsonb,
  p_is_revision boolean
)
returns table (
  order_id uuid,
  quote_id uuid,
  quote_version integer,
  quote_status public.order_quote_status,
  total_cents bigint,
  replayed boolean
)
language plpgsql
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_existing public.order_quotes%rowtype;
  v_quote_id uuid;
  v_version integer;
  v_subtotal_cents bigint;
  v_total_cents bigint;
  v_item_count integer;
  v_distinct_item_count integer;
  v_order_item_count integer;
  v_event_type public.order_quote_event_type;
begin
  if not private.admin_has_commercial_capability(p_admin_user_id, 'manage_quotes') then
    raise exception using errcode = '42501', message = 'QUOTE_ACTOR_NOT_AUTHORIZED';
  end if;
  if p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'QUOTE_REQUEST_HASH_INVALID';
  end if;
  if nullif(btrim(p_commercial_observation), '') is null
     or char_length(btrim(p_commercial_observation)) not between 3 and 4000 then
    raise exception using errcode = '22023', message = 'QUOTE_OBSERVATION_REQUIRED';
  end if;
  if p_is_revision and (
    nullif(btrim(p_change_reason), '') is null
    or char_length(btrim(p_change_reason)) not between 3 and 2000
  ) then
    raise exception using errcode = '22023', message = 'QUOTE_CHANGE_REASON_REQUIRED';
  end if;
  if not p_is_revision and nullif(btrim(p_change_reason), '') is not null then
    raise exception using errcode = '22023', message = 'QUOTE_FIRST_VERSION_REASON_NOT_ALLOWED';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception using errcode = '22023', message = 'QUOTE_EXPIRATION_INVALID';
  end if;
  if p_delivery_fee_cents is null or p_delivery_fee_cents < 0 or p_delivery_fee_cents > 10000000 then
    raise exception using errcode = '22023', message = 'QUOTE_DELIVERY_FEE_INVALID';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'QUOTE_ITEMS_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quote:' || p_order_id::text || ':' || p_idempotency_key::text, 0)
  );

  select quote_row.* into v_existing
  from public.order_quotes as quote_row
  where quote_row.order_id = p_order_id
    and quote_row.idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing.request_hash <> p_request_hash then
      raise exception using errcode = '23505', message = 'QUOTE_IDEMPOTENCY_CONFLICT';
    end if;
    select order_row.quote_status into quote_status
    from public.orders as order_row where order_row.id = p_order_id;
    return query select v_existing.order_id, v_existing.id, v_existing.version,
      quote_status, v_existing.total_cents, true;
    return;
  end if;

  select order_row.* into v_order
  from public.orders as order_row
  where order_row.id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.order_kind <> 'graphic_quote' then
    raise exception using errcode = '22023', message = 'ORDER_NOT_GRAPHIC_QUOTE';
  end if;
  if v_order.quote_status not in ('pending', 'negotiating', 'quoted') then
    raise exception using errcode = '22023', message = 'QUOTE_STATE_LOCKED';
  end if;
  if p_expected_quote_version is null
     or p_expected_quote_version <> v_order.latest_quote_version then
    raise exception using errcode = '40001', message = 'QUOTE_VERSION_CONFLICT';
  end if;
  if (not p_is_revision and v_order.latest_quote_version <> 0)
     or (p_is_revision and v_order.latest_quote_version < 1) then
    raise exception using errcode = '22023', message = 'QUOTE_OPERATION_INVALID';
  end if;
  if exists (
    select 1 from public.order_items as item
    where item.order_id = v_order.id
      and (item.service_id is null or item.product_id is not null)
  ) then
    raise exception using errcode = '22023', message = 'QUOTE_MIXED_ITEMS_NOT_ALLOWED';
  end if;

  select
    count(*)::integer,
    count(distinct nullif(item.value ->> 'order_item_id', '')::uuid)::integer,
    coalesce(sum((item.value ->> 'total_price_cents')::bigint), 0)::bigint
  into v_item_count, v_distinct_item_count, v_subtotal_cents
  from jsonb_array_elements(p_items) as item(value);

  select count(*)::integer into v_order_item_count
  from public.order_items as item
  where item.order_id = v_order.id;

  if v_item_count <> v_distinct_item_count
     or v_item_count <> v_order_item_count
     or exists (
       select 1
       from jsonb_array_elements(p_items) as input_item(value)
       left join public.order_items as stored_item
         on stored_item.id = nullif(input_item.value ->> 'order_item_id', '')::uuid
        and stored_item.order_id = v_order.id
       where stored_item.id is null
         or stored_item.service_id is null
         or stored_item.product_id is not null
         or coalesce((input_item.value ->> 'quantity')::integer, 0) <> stored_item.quantity
         or coalesce((input_item.value ->> 'quantity')::integer, 0) < 1
         or coalesce((input_item.value ->> 'unit_price_cents')::bigint, -1) < 0
         or coalesce((input_item.value ->> 'total_price_cents')::bigint, -1) < 0
         or (input_item.value ->> 'total_price_cents')::bigint <>
            (input_item.value ->> 'unit_price_cents')::bigint *
            (input_item.value ->> 'quantity')::integer
         or nullif(btrim(input_item.value ->> 'label_snapshot'), '') is null
         or char_length(btrim(input_item.value ->> 'label_snapshot')) > 300
         or jsonb_typeof(coalesce(input_item.value -> 'scope_snapshot', '{}'::jsonb)) <> 'object'
     )
     or v_subtotal_cents <= 0
     or v_subtotal_cents + p_delivery_fee_cents > 100000000 then
    raise exception using errcode = '22023', message = 'QUOTE_ITEMS_INVALID';
  end if;

  v_total_cents := v_subtotal_cents + p_delivery_fee_cents;
  v_version := v_order.latest_quote_version + 1;
  v_quote_id := gen_random_uuid();
  v_event_type := (
    case when p_is_revision then 'revised' else 'issued' end
  )::public.order_quote_event_type;

  insert into public.order_quotes (
    id, order_id, version, subtotal_cents, delivery_fee_cents, total_cents,
    commercial_observation, change_reason, expires_at, created_by,
    idempotency_key, request_hash
  ) values (
    v_quote_id, v_order.id, v_version, v_subtotal_cents, p_delivery_fee_cents,
    v_total_cents, btrim(p_commercial_observation),
    case when p_is_revision then btrim(p_change_reason) else null end,
    p_expires_at, p_admin_user_id, p_idempotency_key, p_request_hash
  );

  insert into public.order_quote_items (
    quote_id, order_item_id, line_position, label_snapshot, quantity,
    unit_price_cents, total_price_cents, scope_snapshot
  )
  select
    v_quote_id,
    (input_item.value ->> 'order_item_id')::uuid,
    input_item.ordinality::integer,
    btrim(input_item.value ->> 'label_snapshot'),
    (input_item.value ->> 'quantity')::integer,
    (input_item.value ->> 'unit_price_cents')::bigint,
    (input_item.value ->> 'total_price_cents')::bigint,
    coalesce(input_item.value -> 'scope_snapshot', '{}'::jsonb)
  from jsonb_array_elements(p_items) with ordinality as input_item(value, ordinality);

  update public.orders as order_row
  set latest_quote_version = v_version,
      quote_status = 'quoted',
      quoted_at = now(),
      quote_expires_at = p_expires_at,
      updated_at = now()
  where order_row.id = v_order.id;

  insert into public.order_quote_events (
    order_id, quote_id, event_type, actor_type, admin_user_id,
    idempotency_key, request_hash, note
  ) values (
    v_order.id, v_quote_id, v_event_type, 'admin', p_admin_user_id,
    p_idempotency_key, p_request_hash,
    case when p_is_revision then btrim(p_change_reason) else 'Primeiro orçamento emitido' end
  );

  insert into public.audit_logs (
    admin_user_id, action, entity, entity_id, old_value, new_value
  ) values (
    p_admin_user_id,
    case when p_is_revision then 'revise_order_quote' else 'issue_order_quote' end,
    'orders',
    v_order.id,
    jsonb_build_object('quote_status', v_order.quote_status, 'quote_version', v_order.latest_quote_version),
    jsonb_build_object('quote_status', 'quoted', 'quote_version', v_version, 'total_cents', v_total_cents)
  );

  return query select v_order.id, v_quote_id, v_version,
    'quoted'::public.order_quote_status, v_total_cents, false;
end;
$$;

create or replace function public.issue_order_quote(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_expected_quote_version integer,
  p_idempotency_key uuid,
  p_request_hash text,
  p_commercial_observation text,
  p_expires_at timestamptz,
  p_delivery_fee_cents bigint,
  p_items jsonb
)
returns table (
  order_id uuid,
  quote_id uuid,
  quote_version integer,
  quote_status public.order_quote_status,
  total_cents bigint,
  replayed boolean
)
language sql
security definer
set search_path = ''
as $$
  select * from private.create_order_quote_version(
    p_order_id, p_admin_user_id, p_expected_quote_version,
    p_idempotency_key, p_request_hash, p_commercial_observation, null,
    p_expires_at, p_delivery_fee_cents, p_items, false
  );
$$;

create or replace function public.revise_order_quote(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_expected_quote_version integer,
  p_idempotency_key uuid,
  p_request_hash text,
  p_commercial_observation text,
  p_change_reason text,
  p_expires_at timestamptz,
  p_delivery_fee_cents bigint,
  p_items jsonb
)
returns table (
  order_id uuid,
  quote_id uuid,
  quote_version integer,
  quote_status public.order_quote_status,
  total_cents bigint,
  replayed boolean
)
language sql
security definer
set search_path = ''
as $$
  select * from private.create_order_quote_version(
    p_order_id, p_admin_user_id, p_expected_quote_version,
    p_idempotency_key, p_request_hash, p_commercial_observation,
    p_change_reason, p_expires_at, p_delivery_fee_cents, p_items, true
  );
$$;

create or replace function public.accept_order_quote(
  p_order_id uuid,
  p_quote_id uuid,
  p_expected_quote_version integer,
  p_actor_user_id uuid,
  p_guest_order_token uuid,
  p_idempotency_key uuid,
  p_request_hash text
)
returns table (
  order_id uuid,
  quote_id uuid,
  quote_version integer,
  quote_status public.order_quote_status,
  total_cents bigint,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_quote public.order_quotes%rowtype;
  v_existing_event public.order_quote_events%rowtype;
  v_actor_type public.order_quote_actor_type;
begin
  if p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'QUOTE_REQUEST_HASH_INVALID';
  end if;
  if (p_actor_user_id is null) = (p_guest_order_token is null) then
    raise exception using errcode = '22023', message = 'QUOTE_CUSTOMER_ACTOR_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quote-command:' || p_order_id::text || ':' || p_idempotency_key::text, 0)
  );

  select event_row.* into v_existing_event
  from public.order_quote_events as event_row
  where event_row.order_id = p_order_id
    and event_row.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing_event.event_type <> 'accepted' or v_existing_event.request_hash <> p_request_hash then
      raise exception using errcode = '23505', message = 'QUOTE_IDEMPOTENCY_CONFLICT';
    end if;
    select order_row.* into v_order from public.orders as order_row where order_row.id = p_order_id;
    return query select v_order.id, v_existing_event.quote_id, v_order.latest_quote_version,
      v_order.quote_status, v_order.total_cents, true;
    return;
  end if;

  select order_row.* into v_order
  from public.orders as order_row
  where order_row.id = p_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;
  if v_order.order_kind <> 'graphic_quote' or v_order.quote_status <> 'quoted' then
    raise exception using errcode = '22023', message = 'QUOTE_NOT_ACCEPTABLE';
  end if;
  if p_expected_quote_version <> v_order.latest_quote_version then
    raise exception using errcode = '40001', message = 'QUOTE_VERSION_CONFLICT';
  end if;
  if p_actor_user_id is not null then
    if v_order.user_id is distinct from p_actor_user_id then
      raise exception using errcode = '42501', message = 'QUOTE_ACCESS_DENIED';
    end if;
    v_actor_type := 'customer_authenticated';
  else
    if v_order.user_id is not null
       or v_order.order_token is distinct from p_guest_order_token
       or v_order.guest_access_expires_at is null
       or v_order.guest_access_expires_at <= now() then
      raise exception using errcode = '42501', message = 'QUOTE_ACCESS_DENIED';
    end if;
    v_actor_type := 'customer_guest';
  end if;

  select quote_row.* into v_quote
  from public.order_quotes as quote_row
  where quote_row.id = p_quote_id
    and quote_row.order_id = v_order.id
    and quote_row.version = v_order.latest_quote_version
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'QUOTE_NOT_FOUND';
  end if;
  if v_quote.expires_at <= now() then
    raise exception using errcode = '22023', message = 'QUOTE_EXPIRED';
  end if;
  if exists (
    select 1
    from public.order_quote_items as quoted_item
    join public.order_items as order_item on order_item.id = quoted_item.order_item_id
    where quoted_item.quote_id = v_quote.id
      and (order_item.order_id <> v_order.id or order_item.quantity <> quoted_item.quantity)
  ) then
    raise exception using errcode = '40001', message = 'QUOTE_SCOPE_CHANGED';
  end if;

  perform set_config('app.accepting_quote_order_id', v_order.id::text, true);

  update public.order_items as order_item
  set unit_price_cents = quoted_item.unit_price_cents,
      total_price_cents = quoted_item.total_price_cents,
      original_total_price_cents = quoted_item.total_price_cents,
      unit_price = quoted_item.unit_price_cents::numeric / 100,
      total_price = quoted_item.total_price_cents::numeric / 100,
      discount_cents = 0,
      discount_applied = 0,
      pricing_rule_id = null,
      pricing_rule_snapshot = null
  from public.order_quote_items as quoted_item
  where quoted_item.quote_id = v_quote.id
    and order_item.id = quoted_item.order_item_id;

  update public.orders as order_row
  set accepted_quote_id = v_quote.id,
      quote_status = 'accepted',
      accepted_at = now(),
      status = 'awaiting_payment',
      payment_status = 'pending_contact',
      delivery_fee_cents = v_quote.delivery_fee_cents,
      subtotal_cents = v_quote.subtotal_cents,
      total_cents = v_quote.total_cents,
      original_subtotal_cents = v_quote.subtotal_cents,
      original_total_cents = v_quote.total_cents,
      delivery_fee = v_quote.delivery_fee_cents::numeric / 100,
      subtotal = v_quote.subtotal_cents::numeric / 100,
      total = v_quote.total_cents::numeric / 100,
      price_version = 1,
      updated_at = now()
  where order_row.id = v_order.id;

  perform set_config('app.accepting_quote_order_id', '', true);

  insert into public.order_quote_events (
    order_id, quote_id, event_type, actor_type, actor_user_id,
    idempotency_key, request_hash, note
  ) values (
    v_order.id, v_quote.id, 'accepted', v_actor_type, p_actor_user_id,
    p_idempotency_key, p_request_hash, 'Orçamento aceito pelo cliente'
  );

  insert into public.audit_logs (action, entity, entity_id, old_value, new_value)
  values (
    'accept_order_quote', 'orders', v_order.id,
    jsonb_build_object('quote_status', v_order.quote_status, 'quote_version', v_order.latest_quote_version),
    jsonb_build_object('quote_status', 'accepted', 'quote_version', v_quote.version, 'total_cents', v_quote.total_cents)
  );

  return query select v_order.id, v_quote.id, v_quote.version,
    'accepted'::public.order_quote_status, v_quote.total_cents, false;
end;
$$;

create or replace function public.decline_order_quote(
  p_order_id uuid,
  p_quote_id uuid,
  p_expected_quote_version integer,
  p_actor_user_id uuid,
  p_guest_order_token uuid,
  p_note text,
  p_idempotency_key uuid,
  p_request_hash text
)
returns table (
  order_id uuid,
  quote_id uuid,
  quote_version integer,
  quote_status public.order_quote_status,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_quote public.order_quotes%rowtype;
  v_existing_event public.order_quote_events%rowtype;
  v_actor_type public.order_quote_actor_type;
begin
  if p_request_hash !~ '^[a-f0-9]{64}$'
     or nullif(btrim(p_note), '') is null
     or char_length(btrim(p_note)) not between 3 and 2000 then
    raise exception using errcode = '22023', message = 'QUOTE_DECLINE_INPUT_INVALID';
  end if;
  if (p_actor_user_id is null) = (p_guest_order_token is null) then
    raise exception using errcode = '22023', message = 'QUOTE_CUSTOMER_ACTOR_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quote-command:' || p_order_id::text || ':' || p_idempotency_key::text, 0)
  );
  select event_row.* into v_existing_event
  from public.order_quote_events as event_row
  where event_row.order_id = p_order_id and event_row.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing_event.event_type <> 'declined' or v_existing_event.request_hash <> p_request_hash then
      raise exception using errcode = '23505', message = 'QUOTE_IDEMPOTENCY_CONFLICT';
    end if;
    select order_row.* into v_order from public.orders as order_row where order_row.id = p_order_id;
    return query select v_order.id, v_existing_event.quote_id,
      v_order.latest_quote_version, v_order.quote_status, true;
    return;
  end if;

  select order_row.* into v_order from public.orders as order_row
  where order_row.id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
  if v_order.order_kind <> 'graphic_quote' or v_order.quote_status <> 'quoted'
     or p_expected_quote_version <> v_order.latest_quote_version then
    raise exception using errcode = '40001', message = 'QUOTE_NOT_DECLINABLE';
  end if;
  if p_actor_user_id is not null then
    if v_order.user_id is distinct from p_actor_user_id then
      raise exception using errcode = '42501', message = 'QUOTE_ACCESS_DENIED';
    end if;
    v_actor_type := 'customer_authenticated';
  else
    if v_order.user_id is not null or v_order.order_token is distinct from p_guest_order_token
       or v_order.guest_access_expires_at is null or v_order.guest_access_expires_at <= now() then
      raise exception using errcode = '42501', message = 'QUOTE_ACCESS_DENIED';
    end if;
    v_actor_type := 'customer_guest';
  end if;
  select quote_row.* into v_quote from public.order_quotes as quote_row
  where quote_row.id = p_quote_id and quote_row.order_id = v_order.id
    and quote_row.version = v_order.latest_quote_version;
  if not found then raise exception using errcode = 'P0002', message = 'QUOTE_NOT_FOUND'; end if;

  update public.orders set quote_status = 'declined', quote_expires_at = null, updated_at = now()
  where id = v_order.id;
  insert into public.order_quote_events (
    order_id, quote_id, event_type, actor_type, actor_user_id,
    idempotency_key, request_hash, note
  ) values (
    v_order.id, v_quote.id, 'declined', v_actor_type, p_actor_user_id,
    p_idempotency_key, p_request_hash, btrim(p_note)
  );
  insert into public.audit_logs (action, entity, entity_id, old_value, new_value)
  values ('decline_order_quote', 'orders', v_order.id,
    jsonb_build_object('quote_status', v_order.quote_status),
    jsonb_build_object('quote_status', 'declined', 'quote_version', v_quote.version));

  return query select v_order.id, v_quote.id, v_quote.version,
    'declined'::public.order_quote_status, false;
end;
$$;

create or replace function public.expire_order_quote(
  p_order_id uuid,
  p_quote_id uuid,
  p_expected_quote_version integer,
  p_idempotency_key uuid,
  p_request_hash text
)
returns table (
  order_id uuid,
  quote_id uuid,
  quote_version integer,
  quote_status public.order_quote_status,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_quote public.order_quotes%rowtype;
  v_existing_event public.order_quote_events%rowtype;
begin
  if p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'QUOTE_REQUEST_HASH_INVALID';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quote-command:' || p_order_id::text || ':' || p_idempotency_key::text, 0)
  );
  select event_row.* into v_existing_event from public.order_quote_events as event_row
  where event_row.order_id = p_order_id and event_row.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing_event.event_type <> 'expired' or v_existing_event.request_hash <> p_request_hash then
      raise exception using errcode = '23505', message = 'QUOTE_IDEMPOTENCY_CONFLICT';
    end if;
    select order_row.* into v_order from public.orders as order_row where order_row.id = p_order_id;
    return query select v_order.id, v_existing_event.quote_id,
      v_order.latest_quote_version, v_order.quote_status, true;
    return;
  end if;
  select order_row.* into v_order from public.orders as order_row
  where order_row.id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
  if v_order.order_kind <> 'graphic_quote' or v_order.quote_status <> 'quoted'
     or p_expected_quote_version <> v_order.latest_quote_version then
    raise exception using errcode = '40001', message = 'QUOTE_NOT_EXPIRABLE';
  end if;
  select quote_row.* into v_quote from public.order_quotes as quote_row
  where quote_row.id = p_quote_id and quote_row.order_id = v_order.id
    and quote_row.version = v_order.latest_quote_version;
  if not found then raise exception using errcode = 'P0002', message = 'QUOTE_NOT_FOUND'; end if;
  if v_quote.expires_at > now() then
    raise exception using errcode = '22023', message = 'QUOTE_NOT_EXPIRED';
  end if;
  update public.orders set quote_status = 'expired', quote_expires_at = null, updated_at = now()
  where id = v_order.id;
  insert into public.order_quote_events (
    order_id, quote_id, event_type, actor_type, idempotency_key, request_hash, note
  ) values (
    v_order.id, v_quote.id, 'expired', 'system', p_idempotency_key,
    p_request_hash, 'Orçamento expirado automaticamente'
  );
  insert into public.audit_logs (action, entity, entity_id, old_value, new_value)
  values ('expire_order_quote', 'orders', v_order.id,
    jsonb_build_object('quote_status', v_order.quote_status),
    jsonb_build_object('quote_status', 'expired', 'quote_version', v_quote.version));
  return query select v_order.id, v_quote.id, v_quote.version,
    'expired'::public.order_quote_status, false;
end;
$$;

create or replace function public.cancel_graphic_quote(
  p_order_id uuid,
  p_admin_user_id uuid,
  p_actor_user_id uuid,
  p_guest_order_token uuid,
  p_note text,
  p_idempotency_key uuid,
  p_request_hash text
)
returns table (
  order_id uuid,
  quote_id uuid,
  quote_version integer,
  quote_status public.order_quote_status,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_quote_id uuid;
  v_existing_event public.order_quote_events%rowtype;
  v_actor_type public.order_quote_actor_type;
  v_actor_count integer;
begin
  if p_request_hash !~ '^[a-f0-9]{64}$'
     or nullif(btrim(p_note), '') is null
     or char_length(btrim(p_note)) not between 3 and 2000 then
    raise exception using errcode = '22023', message = 'QUOTE_CANCEL_INPUT_INVALID';
  end if;
  v_actor_count := (p_admin_user_id is not null)::integer
    + (p_actor_user_id is not null)::integer
    + (p_guest_order_token is not null)::integer;
  if v_actor_count <> 1 then
    raise exception using errcode = '22023', message = 'QUOTE_ACTOR_INVALID';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quote-command:' || p_order_id::text || ':' || p_idempotency_key::text, 0)
  );
  select event_row.* into v_existing_event from public.order_quote_events as event_row
  where event_row.order_id = p_order_id and event_row.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing_event.event_type <> 'cancelled' or v_existing_event.request_hash <> p_request_hash then
      raise exception using errcode = '23505', message = 'QUOTE_IDEMPOTENCY_CONFLICT';
    end if;
    select order_row.* into v_order from public.orders as order_row where order_row.id = p_order_id;
    return query select v_order.id, v_existing_event.quote_id,
      v_order.latest_quote_version, v_order.quote_status, true;
    return;
  end if;
  select order_row.* into v_order from public.orders as order_row
  where order_row.id = p_order_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND'; end if;
  if v_order.order_kind <> 'graphic_quote'
     or v_order.quote_status not in ('pending', 'negotiating', 'quoted') then
    raise exception using errcode = '22023', message = 'QUOTE_NOT_CANCELLABLE';
  end if;
  if p_admin_user_id is not null then
    if not private.admin_has_commercial_capability(p_admin_user_id, 'manage_quotes') then
      raise exception using errcode = '42501', message = 'QUOTE_ACTOR_NOT_AUTHORIZED';
    end if;
    v_actor_type := 'admin';
  elsif p_actor_user_id is not null then
    if v_order.user_id is distinct from p_actor_user_id then
      raise exception using errcode = '42501', message = 'QUOTE_ACCESS_DENIED';
    end if;
    v_actor_type := 'customer_authenticated';
  else
    if v_order.user_id is not null or v_order.order_token is distinct from p_guest_order_token
       or v_order.guest_access_expires_at is null or v_order.guest_access_expires_at <= now() then
      raise exception using errcode = '42501', message = 'QUOTE_ACCESS_DENIED';
    end if;
    v_actor_type := 'customer_guest';
  end if;
  select quote_row.id into v_quote_id from public.order_quotes as quote_row
  where quote_row.order_id = v_order.id and quote_row.version = v_order.latest_quote_version;
  update public.orders
  set quote_status = 'cancelled', quote_expires_at = null, status = 'cancelled', updated_at = now()
  where id = v_order.id;
  insert into public.order_quote_events (
    order_id, quote_id, event_type, actor_type, admin_user_id, actor_user_id,
    idempotency_key, request_hash, note
  ) values (
    v_order.id, v_quote_id, 'cancelled', v_actor_type, p_admin_user_id,
    p_actor_user_id, p_idempotency_key, p_request_hash, btrim(p_note)
  );
  insert into public.audit_logs (admin_user_id, action, entity, entity_id, old_value, new_value)
  values (p_admin_user_id, 'cancel_graphic_quote', 'orders', v_order.id,
    jsonb_build_object('quote_status', v_order.quote_status, 'order_status', v_order.status),
    jsonb_build_object('quote_status', 'cancelled', 'order_status', 'cancelled'));
  return query select v_order.id, v_quote_id, v_order.latest_quote_version,
    'cancelled'::public.order_quote_status, false;
end;
$$;

revoke all on function private.admin_has_commercial_capability(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.enforce_payment_capability()
  from public, anon, authenticated, service_role;
revoke all on function private.preserve_quote_history()
  from public, anon, authenticated, service_role;
revoke all on function private.prevent_graphic_quote_price_bypass()
  from public, anon, authenticated, service_role;
revoke all on function private.create_order_quote_version(
  uuid, uuid, integer, uuid, text, text, text, timestamptz, bigint, jsonb, boolean
) from public, anon, authenticated, service_role;

revoke all on function public.issue_order_quote(
  uuid, uuid, integer, uuid, text, text, timestamptz, bigint, jsonb
) from public, anon, authenticated;
revoke all on function public.revise_order_quote(
  uuid, uuid, integer, uuid, text, text, text, timestamptz, bigint, jsonb
) from public, anon, authenticated;
revoke all on function public.accept_order_quote(
  uuid, uuid, integer, uuid, uuid, uuid, text
) from public, anon, authenticated;
revoke all on function public.decline_order_quote(
  uuid, uuid, integer, uuid, uuid, text, uuid, text
) from public, anon, authenticated;
revoke all on function public.expire_order_quote(
  uuid, uuid, integer, uuid, text
) from public, anon, authenticated;
revoke all on function public.cancel_graphic_quote(
  uuid, uuid, uuid, uuid, text, uuid, text
) from public, anon, authenticated;

grant execute on function public.issue_order_quote(
  uuid, uuid, integer, uuid, text, text, timestamptz, bigint, jsonb
) to service_role;
grant execute on function public.revise_order_quote(
  uuid, uuid, integer, uuid, text, text, text, timestamptz, bigint, jsonb
) to service_role;
grant execute on function public.accept_order_quote(
  uuid, uuid, integer, uuid, uuid, uuid, text
) to service_role;
grant execute on function public.decline_order_quote(
  uuid, uuid, integer, uuid, uuid, text, uuid, text
) to service_role;
grant execute on function public.expire_order_quote(
  uuid, uuid, integer, uuid, text
) to service_role;
grant execute on function public.cancel_graphic_quote(
  uuid, uuid, uuid, uuid, text, uuid, text
) to service_role;

comment on table public.order_quotes is
  'Versões imutáveis do orçamento manual; o aceite é registrado no pedido e em eventos, nunca sobrescrevendo a proposta.';
comment on table public.order_quote_items is
  'Snapshot imutável do escopo e dos valores por item em cada versão do orçamento.';
comment on table public.order_quote_events is
  'Trilha idempotente de emissão, revisão, aceite, recusa, expiração e cancelamento.';

commit;
