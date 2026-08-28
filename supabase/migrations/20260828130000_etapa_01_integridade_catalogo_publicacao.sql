-- ETAPA 01 — contrato comercial imutável e publicação segura.
--
-- O snapshot da versão passa a incluir todos os elementos que participam da
-- cotação. Mudanças em componentes filhos também incrementam pricing_version,
-- portanto produzem uma nova versão de catálogo antes de qualquer publicação.

begin;

create or replace function private.snapshot_service_catalog_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_snapshot jsonb;
begin
  if tg_op <> 'INSERT' and new.catalog_version is not distinct from old.catalog_version then
    return new;
  end if;

  select jsonb_build_object(
    'snapshot_contract_version', 2,
    'captured_at', timezone('utc', now()),
    'service', jsonb_build_object(
      'id', new.id,
      'name', new.name,
      'slug', new.slug,
      'description', new.description,
      'image_url', new.image_url,
      'base_price_cents', new.base_price_cents,
      'pricing_fallback_behavior', new.pricing_fallback_behavior,
      'pricing_profile', new.pricing_profile,
      'pricing_profile_config', new.pricing_profile_config,
      'catalog_state', new.catalog_state,
      'is_active', new.is_active,
      'sort_order', new.sort_order,
      'pricing_version', new.pricing_version,
      'catalog_version', new.catalog_version
    ),
    'fields', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', field_row.id,
        'key', field_row.key,
        'label', field_row.label,
        'field_type', field_row.field_type,
        'options', field_row.options,
        'is_required', field_row.is_required,
        'is_active', field_row.is_active,
        'sort_order', field_row.sort_order
      ) order by field_row.sort_order, field_row.id)
      from public.service_fields as field_row
      where field_row.service_id = new.id
    ), '[]'::jsonb),
    'pricing_rules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rule_row.id,
        'name', rule_row.name,
        'price_per_page_cents', rule_row.price_per_page_cents,
        'fallback_behavior', rule_row.fallback_behavior,
        'is_active', rule_row.is_active,
        'rule_version', rule_row.rule_version,
        'field_conditions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'service_field_id', condition_row.service_field_id,
            'expected_value', condition_row.expected_value
          ) order by condition_row.id)
          from public.pricing_rule_field_conditions as condition_row
          where condition_row.pricing_rule_id = rule_row.id
        ), '[]'::jsonb),
        'attributes', coalesce((
          select jsonb_agg(jsonb_build_object(
            'attribute_id', attribute_row.attribute_id,
            'attribute_group_id', attribute_row.attribute_group_id
          ) order by attribute_row.id)
          from public.pricing_rule_attributes as attribute_row
          where attribute_row.pricing_rule_id = rule_row.id
        ), '[]'::jsonb)
      ) order by rule_row.created_at, rule_row.id)
      from public.pricing_rules as rule_row
      where rule_row.service_id = new.id
    ), '[]'::jsonb),
    'pricing_discounts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', discount_row.id,
        'min_quantity', discount_row.min_quantity,
        'max_quantity', discount_row.max_quantity,
        'discount_percent', discount_row.discount_percent,
        'is_active', discount_row.is_active
      ) order by discount_row.min_quantity, discount_row.id)
      from public.pricing_discounts as discount_row
      where discount_row.service_id = new.id
    ), '[]'::jsonb),
    'field_option_dependencies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', dependency_row.id,
        'source_field_id', dependency_row.source_field_id,
        'source_option_value', dependency_row.source_option_value,
        'source_conditions', dependency_row.source_conditions,
        'target_field_id', dependency_row.target_field_id,
        'target_option_value', dependency_row.target_option_value
      ) order by dependency_row.created_at, dependency_row.id)
      from public.service_field_option_dependencies as dependency_row
      where dependency_row.service_id = new.id
    ), '[]'::jsonb),
    'binding_price_tiers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tier_row.id,
        'min_pages', tier_row.min_pages,
        'max_pages', tier_row.max_pages,
        'price_cents', tier_row.price_cents,
        'is_active', tier_row.is_active
      ) order by tier_row.min_pages, tier_row.id)
      from public.service_binding_price_tiers as tier_row
      where tier_row.service_id = new.id
    ), '[]'::jsonb)
  ) into v_snapshot;

  insert into public.service_catalog_versions (
    service_id,
    catalog_version,
    catalog_state,
    snapshot,
    changed_by
  ) values (
    new.id,
    new.catalog_version,
    new.catalog_state,
    v_snapshot,
    new.catalog_updated_by
  ) on conflict (service_id, catalog_version) do nothing;

  return new;
end;
$$;

create or replace function private.bump_service_pricing_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_service_id uuid;
  v_rule_id uuid;
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
    when tg_table_name = 'service_binding_price_tiers' then coalesce(new.service_id, old.service_id)
    else null
  end;

  if v_service_id is null and tg_table_name in ('pricing_rule_field_conditions', 'pricing_rule_attributes') then
    v_rule_id := coalesce(new.pricing_rule_id, old.pricing_rule_id);
    select rule_row.service_id into v_service_id
    from public.pricing_rules as rule_row
    where rule_row.id = v_rule_id;
  end if;

  if v_service_id is not null then
    update public.services
    set pricing_version = pricing_version + 1
    where id = v_service_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists service_binding_price_tiers_pricing_version_bump on public.service_binding_price_tiers;
create trigger service_binding_price_tiers_pricing_version_bump
after insert or update or delete on public.service_binding_price_tiers
for each row execute function private.bump_service_pricing_version();

drop trigger if exists pricing_rule_field_conditions_pricing_version_bump on public.pricing_rule_field_conditions;
create trigger pricing_rule_field_conditions_pricing_version_bump
after insert or update or delete on public.pricing_rule_field_conditions
for each row execute function private.bump_service_pricing_version();

drop trigger if exists pricing_rule_attributes_pricing_version_bump on public.pricing_rule_attributes;
create trigger pricing_rule_attributes_pricing_version_bump
after insert or update or delete on public.pricing_rule_attributes
for each row execute function private.bump_service_pricing_version();

create or replace function private.prevent_published_service_catalog_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_service_id uuid;
  v_rule_id uuid;
begin
  v_service_id := case
    when tg_table_name = 'service_fields' then coalesce(new.service_id, old.service_id)
    when tg_table_name = 'pricing_rules' then coalesce(new.service_id, old.service_id)
    when tg_table_name = 'pricing_discounts' then coalesce(new.service_id, old.service_id)
    when tg_table_name = 'service_field_option_dependencies' then coalesce(new.service_id, old.service_id)
    when tg_table_name = 'service_binding_price_tiers' then coalesce(new.service_id, old.service_id)
    else null
  end;

  if v_service_id is null and tg_table_name in ('pricing_rule_field_conditions', 'pricing_rule_attributes') then
    v_rule_id := coalesce(new.pricing_rule_id, old.pricing_rule_id);
    select rule_row.service_id into v_service_id
    from public.pricing_rules as rule_row
    where rule_row.id = v_rule_id;
  end if;

  if exists (
    select 1
    from public.services as service_row
    where service_row.id = v_service_id
      and service_row.catalog_state = 'published'
      and service_row.deleted_at is null
  ) then
    raise exception using errcode = '55000', message = 'SERVICE_CATALOG_PUBLISHED_EDIT_LOCKED';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists service_fields_published_edit_lock on public.service_fields;
create trigger service_fields_published_edit_lock
before insert or update or delete on public.service_fields
for each row execute function private.prevent_published_service_catalog_mutation();
drop trigger if exists pricing_rules_published_edit_lock on public.pricing_rules;
create trigger pricing_rules_published_edit_lock
before insert or update or delete on public.pricing_rules
for each row execute function private.prevent_published_service_catalog_mutation();
drop trigger if exists pricing_discounts_published_edit_lock on public.pricing_discounts;
create trigger pricing_discounts_published_edit_lock
before insert or update or delete on public.pricing_discounts
for each row execute function private.prevent_published_service_catalog_mutation();
drop trigger if exists service_field_option_dependencies_published_edit_lock on public.service_field_option_dependencies;
create trigger service_field_option_dependencies_published_edit_lock
before insert or update or delete on public.service_field_option_dependencies
for each row execute function private.prevent_published_service_catalog_mutation();
drop trigger if exists service_binding_price_tiers_published_edit_lock on public.service_binding_price_tiers;
create trigger service_binding_price_tiers_published_edit_lock
before insert or update or delete on public.service_binding_price_tiers
for each row execute function private.prevent_published_service_catalog_mutation();
drop trigger if exists pricing_rule_field_conditions_published_edit_lock on public.pricing_rule_field_conditions;
create trigger pricing_rule_field_conditions_published_edit_lock
before insert or update or delete on public.pricing_rule_field_conditions
for each row execute function private.prevent_published_service_catalog_mutation();
drop trigger if exists pricing_rule_attributes_published_edit_lock on public.pricing_rule_attributes;
create trigger pricing_rule_attributes_published_edit_lock
before insert or update or delete on public.pricing_rule_attributes
for each row execute function private.prevent_published_service_catalog_mutation();

create or replace function private.prevent_service_field_pricing_option_removal()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not new.is_active and exists (
    select 1
    from public.pricing_rule_field_conditions as condition_row
    join public.pricing_rules as rule_row on rule_row.id = condition_row.pricing_rule_id
    where condition_row.service_field_id = new.id
      and rule_row.is_active
  ) then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_ACTIVE_PRICING_FIELD_STILL_REFERENCED';
  end if;

  if row(new.key, new.field_type) is distinct from row(old.key, old.field_type) and exists (
    select 1
    from public.pricing_rule_field_conditions as condition_row
    join public.pricing_rules as rule_row on rule_row.id = condition_row.pricing_rule_id
    where condition_row.service_field_id = new.id
      and rule_row.is_active
  ) then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_ACTIVE_PRICING_FIELD_STILL_REFERENCED';
  end if;

  if new.options is distinct from old.options and exists (
    select 1
    from public.pricing_rule_field_conditions as condition_row
    where condition_row.service_field_id = new.id
      and condition_row.expected_value is not null
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(new.options, '[]'::jsonb)) as option_row(value)
        where option_row.value ->> 'value' = trim(both '"' from condition_row.expected_value::text)
      )
  ) then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_PRICING_OPTION_REMOVAL_BLOCKED';
  end if;

  if new.options is distinct from old.options and exists (
    select 1
    from public.pricing_rule_field_conditions as condition_row
    join public.pricing_rules as rule_row on rule_row.id = condition_row.pricing_rule_id
    where condition_row.service_field_id = new.id
      and rule_row.is_active
      and condition_row.expected_value is not null
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(new.options, '[]'::jsonb)) as option_row(value)
        where option_row.value ->> 'value' = trim(both '"' from condition_row.expected_value::text)
          and coalesce((option_row.value ->> 'is_active')::boolean, true)
      )
  ) then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_ACTIVE_PRICING_OPTION_STILL_REFERENCED';
  end if;

  return new;
end;
$$;

drop trigger if exists service_field_pricing_option_protection on public.service_fields;
create trigger service_field_pricing_option_protection
before update of key, field_type, options, is_active on public.service_fields
for each row execute function private.prevent_service_field_pricing_option_removal();

alter table public.order_price_adjustments
  add column if not exists catalog_version integer;

alter table public.order_price_adjustments
  drop constraint if exists order_price_adjustments_catalog_version_valid,
  add constraint order_price_adjustments_catalog_version_valid
    check (catalog_version is null or catalog_version >= 1) not valid;
alter table public.order_price_adjustments
  validate constraint order_price_adjustments_catalog_version_valid;

update public.order_price_adjustments as adjustment
set catalog_version = case
  when (item.pricing_rule_snapshot #>> '{serviceSnapshot,catalogVersion}') ~ '^[1-9][0-9]*$'
    then (item.pricing_rule_snapshot #>> '{serviceSnapshot,catalogVersion}')::integer
  else null
end
from public.order_items as item
where item.id = adjustment.order_item_id
  and adjustment.catalog_version is null;

create or replace function public.adjust_order_item_price(
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
  v_catalog_version integer;
  v_catalog_version_text text;
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

  v_catalog_version_text := v_item.pricing_rule_snapshot #>> '{serviceSnapshot,catalogVersion}';
  if v_catalog_version_text ~ '^[1-9][0-9]*$' then
    v_catalog_version := v_catalog_version_text::integer;
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
    reason, order_version_before, order_version_after, catalog_version
  ) values (
    v_order.id, v_item.id, p_admin_user_id, p_idempotency_key,
    v_item.total_price_cents, p_new_total_cents,
    v_order.subtotal_cents, v_new_subtotal_cents,
    v_order.total_cents, v_new_total_cents,
    btrim(p_reason), v_order.price_version, v_order.price_version + 1, v_catalog_version
  );

  insert into public.audit_logs (admin_user_id, action, entity, entity_id, old_value, new_value)
  values (
    p_admin_user_id, 'adjust_order_item_price', 'orders', v_order.id,
    jsonb_build_object('price_version', v_order.price_version, 'catalog_version', v_catalog_version, 'item_total_cents', v_item.total_price_cents, 'subtotal_cents', v_order.subtotal_cents, 'total_cents', v_order.total_cents),
    jsonb_build_object('price_version', v_order.price_version + 1, 'catalog_version', v_catalog_version, 'item_total_cents', p_new_total_cents, 'subtotal_cents', v_new_subtotal_cents, 'total_cents', v_new_total_cents, 'reason', btrim(p_reason))
  );

  return query select v_order.id, v_new_subtotal_cents, v_new_total_cents, false;
end;
$$;

revoke all on function public.adjust_order_item_price(uuid, uuid, uuid, bigint, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.adjust_order_item_price(uuid, uuid, uuid, bigint, text, uuid, integer)
  to service_role;

comment on table public.service_catalog_versions is
  'Snapshots imutáveis do contrato comercial completo do serviço; versões anteriores ao contrato 2 preservam seu formato histórico.';
comment on column public.order_price_adjustments.catalog_version is
  'Versão do catálogo usada pelo item no instante do ajuste; nula somente para pedidos históricos sem snapshot compatível.';

commit;
