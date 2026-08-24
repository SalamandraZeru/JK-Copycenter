\set ON_ERROR_STOP on

begin;

do $$
begin
  if not exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'store_settings' and rowsecurity
  ) then
    raise exception 'ETAPA03_STORE_SETTINGS_RLS_MISSING';
  end if;
  if has_table_privilege('anon', 'public.store_settings', 'select')
     or has_table_privilege('authenticated', 'public.store_settings', 'update') then
    raise exception 'ETAPA03_STORE_SETTINGS_ACL_OPEN';
  end if;
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('products', 'services', 'pricing_rules', 'orders', 'order_items')
      and column_name like '%_cents'
      and data_type <> 'bigint'
  ) then
    raise exception 'ETAPA03_MONEY_COLUMN_NOT_BIGINT';
  end if;
end $$;

insert into public.categories (id, name, slug)
values ('e3000000-0000-4000-8000-000000000001', 'Etapa 03', 'etapa-03-test');

insert into public.services (
  id, category_id, name, slug, base_price_cents,
  pricing_fallback_behavior, is_active
) values (
  'e3000000-0000-4000-8000-000000000002',
  'e3000000-0000-4000-8000-000000000001',
  'Serviço Etapa 03', 'servico-etapa-03', 50, 'block', true
);

insert into public.attribute_groups (id, name)
values ('e3000000-0000-4000-8000-000000000003', 'Papel Etapa 03');

insert into public.attributes (id, group_id, name)
values (
  'e3000000-0000-4000-8000-000000000004',
  'e3000000-0000-4000-8000-000000000003',
  'A4 Etapa 03'
);

insert into public.pricing_rules (
  id, service_id, name, price_per_page_cents, fallback_behavior, is_active
) values (
  'e3000000-0000-4000-8000-000000000005',
  'e3000000-0000-4000-8000-000000000002',
  'Regra 1', 75, 'block', false
);

insert into public.pricing_rule_attributes (
  pricing_rule_id, attribute_id, attribute_group_id
) values (
  'e3000000-0000-4000-8000-000000000005',
  'e3000000-0000-4000-8000-000000000004',
  'e3000000-0000-4000-8000-000000000003'
);

update public.pricing_rules
set is_active = true
where id = 'e3000000-0000-4000-8000-000000000005';

do $$
begin
  insert into public.pricing_rules (
    id, service_id, name, price_per_page_cents, fallback_behavior, is_active
  ) values (
    'e3000000-0000-4000-8000-000000000006',
    'e3000000-0000-4000-8000-000000000002',
    'Regra ambígua', 10, 'block', false
  );
  insert into public.pricing_rule_attributes (
    pricing_rule_id, attribute_id, attribute_group_id
  ) values (
    'e3000000-0000-4000-8000-000000000006',
    'e3000000-0000-4000-8000-000000000004',
    'e3000000-0000-4000-8000-000000000003'
  );

  begin
    update public.pricing_rules
    set is_active = true
    where id = 'e3000000-0000-4000-8000-000000000006';
    raise exception 'ETAPA03_AMBIGUOUS_RULE_ACCEPTED';
  exception
    when unique_violation then
      if sqlerrm not like '%AMBIGUOUS_PRICING_RULE%' then raise; end if;
  end;
end $$;

insert into public.orders (
  id, order_number, order_token, idempotency_key, payment_method,
  checkout_request_hash, checkout_actor_hash,
  delivery_fee_cents, subtotal_cents, total_cents
) values (
  'e3000000-0000-4000-8000-000000000007', 'JK-E3-0001',
  'e3000000-0000-4000-8000-000000000008',
  'e3000000-0000-4000-8000-000000000009', 'pix', repeat('e',64), repeat('f',64), 0, 75, 75
);

insert into public.order_items (
  id, order_id, service_id, service_name_snapshot, fields_snapshot,
  quantity, pages_count, unit_price_cents, total_price_cents,
  pricing_rule_id, pricing_rule_snapshot, discount_cents
) values (
  'e3000000-0000-4000-8000-000000000010',
  'e3000000-0000-4000-8000-000000000007',
  'e3000000-0000-4000-8000-000000000002',
  'Serviço Etapa 03', '[]', 1, 1, 75, 75,
  'e3000000-0000-4000-8000-000000000005',
  '{"schemaVersion":1,"pricePerPageCents":75,"pricingVersion":1}', 0
);

update public.pricing_rules
set price_per_page_cents = 125
where id = 'e3000000-0000-4000-8000-000000000005';

do $$
declare
  v_old_total bigint;
  v_old_snapshot bigint;
  v_projection numeric;
begin
  select total_price_cents, (pricing_rule_snapshot->>'pricePerPageCents')::bigint
  into v_old_total, v_old_snapshot
  from public.order_items
  where id = 'e3000000-0000-4000-8000-000000000010';

  select price_per_page into v_projection
  from public.pricing_rules
  where id = 'e3000000-0000-4000-8000-000000000005';

  if v_old_total <> 75 or v_old_snapshot <> 75 then
    raise exception 'ETAPA03_HISTORICAL_SNAPSHOT_MUTATED';
  end if;
  if v_projection <> 1.25 then
    raise exception 'ETAPA03_LEGACY_MONEY_PROJECTION_INCORRECT';
  end if;
end $$;

do $$
begin
  begin
    update public.store_settings
    set value = '"not-an-integer"'::jsonb
    where key = 'delivery_fee_cents';
    raise exception 'ETAPA03_INVALID_SETTING_ACCEPTED';
  exception
    when check_violation then
      if sqlerrm not like '%STORE_SETTING_TYPE_MISMATCH%' then raise; end if;
  end;
end $$;

rollback;

select 'ETAPA_03_DATABASE_OK' as result;
