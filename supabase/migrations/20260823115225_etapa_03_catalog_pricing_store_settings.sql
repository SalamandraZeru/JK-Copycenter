-- ETAPA 03 — catálogo, configuração e preço confiável.
-- A moeda canônica passa a ser armazenada em centavos inteiros. As colunas
-- decimais existentes permanecem temporariamente como projeção de
-- compatibilidade para as telas legadas e serão removidas em etapa posterior.

alter table public.products
  add column price_cents bigint;

alter table public.services
  add column base_price_cents bigint,
  add column pricing_fallback_behavior text not null default 'block',
  add column pricing_version bigint not null default 1;

alter table public.pricing_rules
  add column price_per_page_cents bigint,
  add column rule_version bigint not null default 1;

alter table public.orders
  add column delivery_fee_cents bigint,
  add column subtotal_cents bigint,
  add column total_cents bigint;

alter table public.order_items
  add column unit_price_cents bigint,
  add column total_price_cents bigint,
  add column discount_cents bigint;

update public.products
set price_cents = round(price * 100)::bigint;

update public.services
set base_price_cents = round(base_price * 100)::bigint,
    pricing_fallback_behavior = case
      when exists (
        select 1
        from public.pricing_rules pr
        where pr.service_id = services.id
          and pr.fallback_behavior = 'use_base'
      ) then 'use_base'
      else 'block'
    end;

update public.pricing_rules
set price_per_page_cents = round(price_per_page * 100)::bigint;

update public.orders
set delivery_fee_cents = round(delivery_fee * 100)::bigint,
    subtotal_cents = round(subtotal * 100)::bigint,
    total_cents = round(total * 100)::bigint;

update public.order_items
set unit_price_cents = round(unit_price * 100)::bigint,
    total_price_cents = round(total_price * 100)::bigint,
    discount_cents = round(coalesce(discount_applied, 0) * 100)::bigint;

alter table public.products
  alter column price_cents set not null,
  alter column price_cents drop default,
  add constraint products_price_cents_nonnegative check (price_cents >= 0);

alter table public.services
  alter column base_price_cents set not null,
  alter column base_price_cents drop default,
  add constraint services_base_price_cents_nonnegative check (base_price_cents >= 0),
  add constraint services_pricing_fallback_valid
    check (pricing_fallback_behavior in ('use_base', 'block')),
  add constraint services_pricing_version_positive check (pricing_version >= 1);

alter table public.pricing_rules
  alter column price_per_page_cents set not null,
  add constraint pricing_rules_price_cents_nonnegative check (price_per_page_cents >= 0),
  add constraint pricing_rules_version_positive check (rule_version >= 1);

alter table public.orders
  alter column delivery_fee_cents set not null,
  alter column delivery_fee_cents drop default,
  alter column subtotal_cents set not null,
  alter column subtotal_cents drop default,
  alter column total_cents set not null,
  alter column total_cents drop default,
  add constraint orders_delivery_fee_cents_nonnegative check (delivery_fee_cents >= 0),
  add constraint orders_subtotal_cents_nonnegative check (subtotal_cents >= 0),
  add constraint orders_total_cents_nonnegative check (total_cents >= 0);

alter table public.order_items
  alter column unit_price_cents set not null,
  alter column unit_price_cents drop default,
  alter column total_price_cents set not null,
  alter column total_price_cents drop default,
  alter column discount_cents set not null,
  alter column discount_cents drop default,
  add constraint order_items_unit_price_cents_nonnegative check (unit_price_cents >= 0),
  add constraint order_items_total_price_cents_nonnegative check (total_price_cents >= 0),
  add constraint order_items_discount_cents_nonnegative check (discount_cents >= 0);

-- Compatibilidade controlada: qualquer gravação deve informar os centavos.
-- O trigger projeta os valores canônicos nas colunas decimais legadas.
create or replace function private.sync_catalog_money_projection()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'products' then
    if tg_op = 'INSERT' and new.price_cents is null then
      new.price_cents := round(coalesce(new.price, 0) * 100)::bigint;
    elsif tg_op = 'UPDATE' and new.price_cents is not distinct from old.price_cents
          and new.price is distinct from old.price then
      new.price_cents := round(new.price * 100)::bigint;
    end if;
    new.price := new.price_cents::numeric / 100;
  elsif tg_table_name = 'services' then
    if tg_op = 'INSERT' and new.base_price_cents is null then
      new.base_price_cents := round(coalesce(new.base_price, 0) * 100)::bigint;
    elsif tg_op = 'UPDATE' and new.base_price_cents is not distinct from old.base_price_cents
          and new.base_price is distinct from old.base_price then
      new.base_price_cents := round(new.base_price * 100)::bigint;
    end if;
    new.base_price := new.base_price_cents::numeric / 100;
  elsif tg_table_name = 'pricing_rules' then
    if tg_op = 'INSERT' and new.price_per_page_cents is null then
      new.price_per_page_cents := round(coalesce(new.price_per_page, 0) * 100)::bigint;
    elsif tg_op = 'UPDATE' and new.price_per_page_cents is not distinct from old.price_per_page_cents
          and new.price_per_page is distinct from old.price_per_page then
      new.price_per_page_cents := round(new.price_per_page * 100)::bigint;
    end if;
    new.price_per_page := new.price_per_page_cents::numeric / 100;
  end if;
  return new;
end;
$$;

create trigger products_money_projection
before insert or update on public.products
for each row execute function private.sync_catalog_money_projection();

create trigger services_money_projection
before insert or update on public.services
for each row execute function private.sync_catalog_money_projection();

create trigger pricing_rules_money_projection
before insert or update on public.pricing_rules
for each row execute function private.sync_catalog_money_projection();

create or replace function private.sync_order_money_projection()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'orders' then
    if tg_op = 'INSERT' then
      new.delivery_fee_cents := coalesce(new.delivery_fee_cents, round(coalesce(new.delivery_fee, 0) * 100)::bigint);
      new.subtotal_cents := coalesce(new.subtotal_cents, round(coalesce(new.subtotal, 0) * 100)::bigint);
      new.total_cents := coalesce(new.total_cents, round(coalesce(new.total, 0) * 100)::bigint);
    else
      if new.delivery_fee_cents is not distinct from old.delivery_fee_cents and new.delivery_fee is distinct from old.delivery_fee then
        new.delivery_fee_cents := round(new.delivery_fee * 100)::bigint;
      end if;
      if new.subtotal_cents is not distinct from old.subtotal_cents and new.subtotal is distinct from old.subtotal then
        new.subtotal_cents := round(new.subtotal * 100)::bigint;
      end if;
      if new.total_cents is not distinct from old.total_cents and new.total is distinct from old.total then
        new.total_cents := round(new.total * 100)::bigint;
      end if;
    end if;
    new.delivery_fee := new.delivery_fee_cents::numeric / 100;
    new.subtotal := new.subtotal_cents::numeric / 100;
    new.total := new.total_cents::numeric / 100;
  elsif tg_table_name = 'order_items' then
    if tg_op = 'INSERT' then
      new.unit_price_cents := coalesce(new.unit_price_cents, round(coalesce(new.unit_price, 0) * 100)::bigint);
      new.total_price_cents := coalesce(new.total_price_cents, round(coalesce(new.total_price, 0) * 100)::bigint);
      new.discount_cents := coalesce(new.discount_cents, round(coalesce(new.discount_applied, 0) * 100)::bigint);
    else
      if new.unit_price_cents is not distinct from old.unit_price_cents and new.unit_price is distinct from old.unit_price then
        new.unit_price_cents := round(new.unit_price * 100)::bigint;
      end if;
      if new.total_price_cents is not distinct from old.total_price_cents and new.total_price is distinct from old.total_price then
        new.total_price_cents := round(new.total_price * 100)::bigint;
      end if;
      if new.discount_cents is not distinct from old.discount_cents and new.discount_applied is distinct from old.discount_applied then
        new.discount_cents := round(coalesce(new.discount_applied, 0) * 100)::bigint;
      end if;
    end if;
    new.unit_price := new.unit_price_cents::numeric / 100;
    new.total_price := new.total_price_cents::numeric / 100;
    new.discount_applied := new.discount_cents::numeric / 100;
  end if;
  return new;
end;
$$;

create trigger orders_money_projection
before insert or update on public.orders
for each row execute function private.sync_order_money_projection();

create trigger order_items_money_projection
before insert or update on public.order_items
for each row execute function private.sync_order_money_projection();

-- Uma ligação de regra passa a identificar o grupo inclusive para coringas.
alter table public.pricing_rule_attributes
  add column attribute_group_id uuid references public.attribute_groups(id) on delete cascade;

update public.pricing_rule_attributes pra
set attribute_group_id = a.group_id
from public.attributes a
where a.id = pra.attribute_id;

alter table public.pricing_rule_attributes
  alter column attribute_group_id set not null;

alter table public.pricing_rule_attributes
  drop constraint uq_rule_attribute;

alter table public.pricing_rule_attributes
  add constraint pricing_rule_attributes_one_per_group
  unique (pricing_rule_id, attribute_group_id);

create index pricing_rule_attributes_group_id_idx
  on public.pricing_rule_attributes(attribute_group_id);

create or replace function private.validate_rule_attribute_group()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  if new.attribute_id is not null then
    select a.group_id into v_group_id
    from public.attributes a
    where a.id = new.attribute_id;

    new.attribute_group_id := coalesce(new.attribute_group_id, v_group_id);

    if v_group_id is null or v_group_id <> new.attribute_group_id then
      raise exception using
        errcode = '23514',
        message = 'ATTRIBUTE_GROUP_MISMATCH';
    end if;
  end if;
  return new;
end;
$$;

create trigger pricing_rule_attribute_group_guard
before insert or update on public.pricing_rule_attributes
for each row execute function private.validate_rule_attribute_group();

-- Duas regras ativas de mesma especificidade que podem atender à mesma
-- seleção tornam a cotação não determinística e são rejeitadas.
create or replace function private.assert_pricing_rule_unambiguous(p_rule_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_service_id uuid;
  v_is_active boolean;
  v_specificity integer;
begin
  select pr.service_id, pr.is_active,
         count(pra.attribute_id)::integer
  into v_service_id, v_is_active, v_specificity
  from public.pricing_rules pr
  left join public.pricing_rule_attributes pra on pra.pricing_rule_id = pr.id
  where pr.id = p_rule_id
  group by pr.service_id, pr.is_active;

  if not coalesce(v_is_active, false) then
    return;
  end if;

  if exists (
    select 1
    from public.pricing_rules other_rule
    where other_rule.service_id = v_service_id
      and other_rule.is_active
      and other_rule.id <> p_rule_id
      and (
        select count(*)::integer
        from public.pricing_rule_attributes other_attr
        where other_attr.pricing_rule_id = other_rule.id
          and other_attr.attribute_id is not null
      ) = v_specificity
      and not exists (
        select 1
        from public.pricing_rule_attributes candidate_attr
        join public.pricing_rule_attributes other_attr
          on other_attr.pricing_rule_id = other_rule.id
         and other_attr.attribute_group_id = candidate_attr.attribute_group_id
        where candidate_attr.pricing_rule_id = p_rule_id
          and candidate_attr.attribute_id is not null
          and other_attr.attribute_id is not null
          and candidate_attr.attribute_id <> other_attr.attribute_id
      )
  ) then
    raise exception using
      errcode = '23505',
      message = 'AMBIGUOUS_PRICING_RULE';
  end if;
end;
$$;

create or replace function private.check_pricing_rule_activation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.assert_pricing_rule_unambiguous(new.id);
  return new;
end;
$$;

create trigger pricing_rule_activation_guard
after insert or update of is_active, service_id on public.pricing_rules
for each row execute function private.check_pricing_rule_activation();

create or replace function private.check_pricing_rule_attributes_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rule_id uuid := coalesce(new.pricing_rule_id, old.pricing_rule_id);
begin
  perform private.assert_pricing_rule_unambiguous(v_rule_id);
  return coalesce(new, old);
end;
$$;

create trigger pricing_rule_attributes_ambiguity_guard
after insert or update or delete on public.pricing_rule_attributes
for each row execute function private.check_pricing_rule_attributes_change();

create or replace function private.assert_discount_unambiguous()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.is_active and exists (
    select 1
    from public.pricing_discounts d
    where d.service_id = new.service_id
      and d.is_active
      and d.id <> new.id
      and int8range(d.min_quantity, coalesce(d.max_quantity, 2147483647) + 1, '[)')
          && int8range(new.min_quantity, coalesce(new.max_quantity, 2147483647) + 1, '[)')
  ) then
    raise exception using
      errcode = '23505',
      message = 'AMBIGUOUS_PRICING_DISCOUNT';
  end if;
  return new;
end;
$$;

create trigger pricing_discount_ambiguity_guard
before insert or update on public.pricing_discounts
for each row execute function private.assert_discount_unambiguous();

-- Versionamento do catálogo usado nos snapshots de cotação/pedido.
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

create trigger services_pricing_version_guard
before update on public.services
for each row execute function private.bump_service_pricing_version();

create trigger service_fields_pricing_version_bump
after insert or update or delete on public.service_fields
for each row execute function private.bump_service_pricing_version();

create trigger pricing_rules_version_bump
after insert or update or delete on public.pricing_rules
for each row execute function private.bump_service_pricing_version();

create trigger pricing_discounts_version_bump
after insert or update or delete on public.pricing_discounts
for each row execute function private.bump_service_pricing_version();

-- Configuração central tipada. Nenhuma permissão de Data API é concedida;
-- leitura e mutação acontecem somente por rotas server-side autorizadas.
create table public.store_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{0,99}$'),
  value jsonb not null,
  value_type text not null check (value_type in ('string', 'number', 'boolean', 'object', 'array', 'null')),
  value_schema jsonb not null default '{}'::jsonb,
  description text,
  allowed_roles public.admin_role[] not null,
  is_sensitive boolean not null default false,
  updated_by uuid references public.admin_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.store_settings enable row level security;
revoke all on table public.store_settings from public, anon, authenticated;
grant all on table public.store_settings to service_role;

insert into public.store_settings (
  key, value, value_type, value_schema, description, allowed_roles, is_sensitive
)
select
  case sc.key
    when 'delivery_fee' then 'delivery_fee_cents'
    when 'double_sided_multiplier' then 'double_sided_multiplier_bps'
    else sc.key
  end,
  case sc.key
    when 'delivery_fee' then to_jsonb(round((sc.value #>> '{}')::numeric * 100)::bigint)
    when 'double_sided_multiplier' then to_jsonb(round((sc.value #>> '{}')::numeric * 10000)::bigint)
    else sc.value
  end,
  case
    when sc.key in ('delivery_fee', 'double_sided_multiplier') then 'number'
    else jsonb_typeof(sc.value)
  end,
  jsonb_build_object('type', case
    when sc.key in ('delivery_fee', 'double_sided_multiplier') then 'integer'
    else jsonb_typeof(sc.value)
  end),
  sc.description,
  case
    when sc.key in (
      'pix_key', 'pix_owner_name', 'upload_max_size_bytes',
      'upload_max_files_per_order', 'max_upload_size_mb',
      'max_files_per_order', 'max_zip_uncompressed_mb',
      'zip_max_compression_ratio', 'signed_url_expiry_seconds',
      'data_retention_days', 'stock_management_mode'
    ) then array['super_admin']::public.admin_role[]
    else array['super_admin', 'admin']::public.admin_role[]
  end,
  sc.key in ('pix_key', 'pix_owner_name')
from public.system_config sc
on conflict (key) do update
set value = excluded.value,
    value_type = excluded.value_type,
    value_schema = excluded.value_schema,
    description = excluded.description,
    allowed_roles = excluded.allowed_roles,
    is_sensitive = excluded.is_sensitive;

insert into public.store_settings (
  key, value, value_type, value_schema, description, allowed_roles, is_sensitive
) values
  (
    'pricing_rounding_mode', '"half_up"', 'string',
    '{"type":"string","enum":["half_up","floor","ceil"]}',
    'Arredondamento aplicado em cada operação monetária',
    array['super_admin', 'admin']::public.admin_role[], false
  ),
  (
    'guest_order_access_days', '30', 'number',
    '{"type":"integer","minimum":1,"maximum":365}',
    'Prazo de consulta de pedido por visitante',
    array['super_admin']::public.admin_role[], false
  ),
  (
    'delivery_enabled', 'true', 'boolean',
    '{"type":"boolean"}',
    'Permite entrega no checkout',
    array['super_admin', 'admin']::public.admin_role[], false
  ),
  (
    'pickup_enabled', 'true', 'boolean',
    '{"type":"boolean"}',
    'Permite retirada na loja no checkout',
    array['super_admin', 'admin']::public.admin_role[], false
  ),
  (
    'home_banner_text', '""', 'string',
    '{"type":"string","maxLength":500}',
    'Aviso opcional exibido na página inicial',
    array['super_admin', 'admin']::public.admin_role[], false
  ),
  (
    'delivery_state', '""', 'string',
    '{"type":"string","pattern":"^[A-Z]{2}$|^$"}',
    'UF atendida para entrega; deve ser confirmada pelo responsável',
    array['super_admin', 'admin']::public.admin_role[], false
  )
on conflict (key) do nothing;

create or replace function private.validate_store_setting()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_json_type text := jsonb_typeof(new.value);
  v_number numeric;
begin
  if v_json_type is distinct from new.value_type then
    raise exception using errcode = '23514', message = 'STORE_SETTING_TYPE_MISMATCH';
  end if;

  if new.value_type = 'number' then
    v_number := (new.value #>> '{}')::numeric;
  end if;

  if new.key = 'delivery_fee_cents' and (v_number < 0 or v_number <> trunc(v_number)) then
    raise exception using errcode = '23514', message = 'INVALID_DELIVERY_FEE_CENTS';
  elsif new.key = 'double_sided_multiplier_bps'
        and (v_number < 10000 or v_number > 100000 or v_number <> trunc(v_number)) then
    raise exception using errcode = '23514', message = 'INVALID_DOUBLE_SIDED_MULTIPLIER';
  elsif new.key = 'pricing_rounding_mode'
        and (new.value #>> '{}') not in ('half_up', 'floor', 'ceil') then
    raise exception using errcode = '23514', message = 'INVALID_PRICING_ROUNDING_MODE';
  elsif new.key = 'whatsapp_number'
        and (new.value #>> '{}') !~ '^[0-9]{0,15}$' then
    raise exception using errcode = '23514', message = 'INVALID_WHATSAPP_NUMBER';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger store_settings_validation
before insert or update on public.store_settings
for each row execute function private.validate_store_setting();

create or replace function private.audit_store_setting_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    admin_user_id, action, entity, entity_id, old_value, new_value
  ) values (
    new.updated_by,
    case when tg_op = 'INSERT' then 'create_store_setting' else 'update_store_setting' end,
    'store_settings',
    null,
    case when tg_op = 'UPDATE' then jsonb_build_object('key', old.key, 'value', old.value) else null end,
    jsonb_build_object('key', new.key, 'value', case when new.is_sensitive then '"[REDACTED]"'::jsonb else new.value end)
  );
  return new;
end;
$$;

create trigger store_settings_audit
after insert or update on public.store_settings
for each row execute function private.audit_store_setting_change();

-- As funções internas não compõem a API pública.
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;

comment on table public.store_settings is
  'Fonte central, tipada e auditada de configuração operacional da loja.';
comment on column public.products.price_cents is 'Preço canônico inteiro em centavos.';
comment on column public.services.base_price_cents is 'Preço-base canônico inteiro em centavos.';
comment on column public.pricing_rules.price_per_page_cents is 'Preço unitário canônico inteiro em centavos.';
