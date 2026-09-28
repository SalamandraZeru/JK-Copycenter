begin;

-- Etapa 3: contratos transacionais distintos para compra de papelaria e
-- solicitacao de orcamento grafico. Ambos permanecem privados ao service_role;
-- clientes nunca recebem EXECUTE direto nestes RPCs.

create or replace function public.commit_stationery_checkout(
  p_idempotency_key uuid,
  p_request_hash text,
  p_user_id uuid,
  p_guest_email text,
  p_guest_upload_session_hash text,
  p_order jsonb,
  p_items jsonb
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
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_subtotal_cents bigint := 0;
  v_delivery_fee_cents bigint;
  v_authoritative_items jsonb := '[]'::jsonb;
  v_authoritative_order jsonb;
  v_result record;
begin
  if jsonb_typeof(p_order) <> 'object'
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 1000 then
    raise exception using errcode = '22023', message = 'STATIONERY_CHECKOUT_PAYLOAD_INVALID';
  end if;
  if p_guest_upload_session_hash is not null then
    raise exception using errcode = '22023', message = 'STATIONERY_CHECKOUT_FILES_NOT_ALLOWED';
  end if;

  v_delivery_fee_cents := coalesce((p_order ->> 'delivery_fee_cents')::bigint, 0);
  if v_delivery_fee_cents < 0 then
    raise exception using errcode = '22023', message = 'CHECKOUT_TOTAL_INVALID';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or nullif(v_item ->> 'product_id', '') is null
       or nullif(v_item ->> 'service_id', '') is not null
       or coalesce(v_item -> 'file_ids', '[]'::jsonb) <> '[]'::jsonb then
      raise exception using errcode = '22023', message = 'STATIONERY_CHECKOUT_PRODUCT_ONLY';
    end if;

    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity < 1 or v_quantity > 100000000 then
      raise exception using errcode = '22023', message = 'CHECKOUT_ITEM_INVALID';
    end if;

    select product.* into v_product
    from public.products as product
    where product.id = (v_item ->> 'product_id')::uuid
      and product.is_active
      and product.deleted_at is null
    for update;
    if not found or v_product.price_cents <= 0 then
      raise exception using errcode = '22023', message = 'PRODUCT_UNAVAILABLE';
    end if;

    if v_product.stock_control_enabled
       and (v_product.stock_quantity is null
         or v_product.stock_quantity - v_product.reserved_quantity < v_quantity) then
      raise exception using errcode = 'P0001', message = 'STOCK_UNAVAILABLE';
    end if;

    if v_product.price_cents > 100000000
       or v_quantity > 100000000 / v_product.price_cents then
      raise exception using errcode = '22003', message = 'CHECKOUT_TOTAL_OUT_OF_RANGE';
    end if;
    v_subtotal_cents := v_subtotal_cents + (v_product.price_cents * v_quantity);
    if v_subtotal_cents > 100000000 then
      raise exception using errcode = '22003', message = 'CHECKOUT_TOTAL_OUT_OF_RANGE';
    end if;

    v_authoritative_items := v_authoritative_items || jsonb_build_array(jsonb_build_object(
      'service_id', null,
      'product_id', v_product.id,
      'service_name_snapshot', null,
      'service_description_snapshot', v_product.description,
      'product_name_snapshot', v_product.name,
      'fields_snapshot', '{}'::jsonb,
      'quantity', v_quantity,
      'pages_count', 0,
      'pages_method', 'exact',
      'is_double_sided', false,
      'unit_price_cents', v_product.price_cents,
      'total_price_cents', v_product.price_cents * v_quantity,
      'pricing_rule_id', null,
      'pricing_rule_snapshot', null,
      'discount_cents', 0,
      'file_ids', '[]'::jsonb
    ));
  end loop;

  v_authoritative_order := p_order || jsonb_build_object(
    'subtotal_cents', v_subtotal_cents,
    'total_cents', v_subtotal_cents + v_delivery_fee_cents
  );

  select * into v_result
  from public.commit_checkout(
    p_idempotency_key,
    p_request_hash,
    p_user_id,
    p_guest_email,
    null,
    v_authoritative_order,
    v_authoritative_items,
    '{}'::uuid[]
  );

  if not v_result.replayed then
    update public.orders
    set order_kind = 'stationery_sale'
    where id = v_result.order_id
      and order_kind = 'legacy_checkout';
    if not found then
      raise exception using errcode = 'P0001', message = 'STATIONERY_ORDER_KIND_INVALID';
    end if;
  elsif not exists (
    select 1 from public.orders
    where id = v_result.order_id
      and order_kind in ('stationery_sale', 'legacy_checkout')
      and not exists (
        select 1 from public.order_items as order_item
        where order_item.order_id = v_result.order_id
          and order_item.product_id is null
      )
  ) then
    raise exception using errcode = '23505', message = 'IDEMPOTENCY_CONFLICT';
  end if;

  return query select
    v_result.order_id,
    v_result.order_number,
    v_result.order_code,
    v_result.total_cents,
    v_result.payment_method,
    v_result.replayed;
end;
$$;

create or replace function public.commit_graphic_quote_request(
  p_idempotency_key uuid,
  p_request_hash text,
  p_user_id uuid,
  p_guest_email text,
  p_guest_upload_session_hash text,
  p_customer jsonb,
  p_items jsonb,
  p_file_ids uuid[]
)
returns table (
  request_id uuid,
  protocol text,
  request_code uuid,
  quote_status public.order_quote_status,
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
  v_user_id uuid := p_user_id;
  v_guest_email text := nullif(lower(btrim(p_guest_email)), '');
  v_guest_access_days integer;
  v_expected_file_count integer := coalesce(cardinality(p_file_ids), 0);
  v_distinct_file_count integer;
  v_total_linked_file_count integer;
  v_item jsonb;
  v_item_id uuid;
  v_service record;
  v_service_id uuid;
  v_catalog_version bigint;
  v_quantity integer;
  v_file_id uuid;
  v_linked_file_count integer;
  v_item_file_count integer;
  v_item_page_count integer;
  v_item_page_method public.page_count_method;
  v_fields_snapshot jsonb;
begin
  if p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_IDEMPOTENCY_REQUEST_HASH';
  end if;
  if (v_user_id is null) = (v_guest_email is null)
     or (v_user_id is not null and p_guest_upload_session_hash is not null) then
    raise exception using errcode = '22023', message = 'QUOTE_REQUEST_ACTOR_INVALID';
  end if;
  if jsonb_typeof(p_customer) <> 'object'
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = '22023', message = 'QUOTE_REQUEST_PAYLOAD_INVALID';
  end if;
  if v_expected_file_count < 1 or v_expected_file_count > 100 then
    raise exception using errcode = '22023', message = 'QUOTE_REQUEST_FILES_REQUIRED';
  end if;

  select count(distinct file_id) into v_distinct_file_count
  from unnest(coalesce(p_file_ids, '{}'::uuid[])) as file_id;
  if v_distinct_file_count <> v_expected_file_count then
    raise exception using errcode = '22023', message = 'FILE_ACCESS_DENIED';
  end if;

  if v_user_id is not null then
    v_actor_hash := encode(extensions.digest('user:' || v_user_id::text, 'sha256'), 'hex');
  else
    v_actor_hash := encode(extensions.digest('guest:' || v_guest_email, 'sha256'), 'hex');
    if coalesce(p_guest_upload_session_hash, '') !~ '^[a-f0-9]{64}$' then
      raise exception using errcode = '22023', message = 'FILE_ACCESS_DENIED';
    end if;
    select (value #>> '{}')::integer into v_guest_access_days
    from public.store_settings where key = 'guest_order_access_days';
    if v_guest_access_days is null or v_guest_access_days < 1 then
      raise exception using errcode = '22023', message = 'CONFIG_UNAVAILABLE: guest_order_access_days';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor_hash || ':' || p_idempotency_key::text, 0)
  );

  select order_row.* into v_existing
  from public.orders as order_row
  where order_row.checkout_actor_hash = v_actor_hash
    and order_row.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing.checkout_request_hash <> p_request_hash
       or v_existing.order_kind <> 'graphic_quote' then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    return query select v_existing.id, v_existing.order_number,
      v_existing.order_token, v_existing.quote_status, true;
    return;
  end if;

  v_order_id := pg_catalog.gen_random_uuid();
  v_order_code := pg_catalog.gen_random_uuid();
  v_order_number := format(
    'JK-%s-%s',
    extract(year from current_date)::text,
    upper(substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 12))
  );

  insert into public.orders (
    id, order_number, order_token, user_id, guest_email, guest_name, guest_phone,
    guest_access_expires_at, idempotency_key, checkout_request_hash,
    checkout_actor_hash, status, order_kind, quote_status, delivery_type,
    delivery_address_snapshot, delivery_fee_cents, subtotal_cents, total_cents,
    payment_method, payment_status, pix_key_used, notes
  ) values (
    v_order_id, v_order_number, v_order_code, v_user_id, v_guest_email,
    nullif(btrim(p_customer ->> 'name'), ''),
    nullif(btrim(p_customer ->> 'phone'), ''),
    case when v_user_id is null then now() + make_interval(days => v_guest_access_days) else null end,
    p_idempotency_key, p_request_hash, v_actor_hash, 'created', 'graphic_quote',
    'pending', 'pickup', null, 0, 0, 0, null, 'pending_contact', null,
    nullif(btrim(p_customer ->> 'notes'), '')
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or nullif(v_item ->> 'service_id', '') is null
       or v_item ? 'product_id'
       or v_item ? 'unit_price_cents'
       or v_item ? 'total_price_cents'
       or v_item ? 'payment_method'
       or v_item ? 'delivery_fee_cents'
       or jsonb_typeof(v_item -> 'file_ids') <> 'array'
       or jsonb_array_length(v_item -> 'file_ids') = 0 then
      raise exception using errcode = '22023', message = 'GRAPHIC_QUOTE_SERVICE_ONLY';
    end if;

    v_service_id := (v_item ->> 'service_id')::uuid;
    v_catalog_version := (v_item ->> 'catalog_version')::bigint;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_fields_snapshot := v_item -> 'fields_snapshot';
    if v_quantity < 1 or v_quantity > 100000000
       or jsonb_typeof(v_fields_snapshot) <> 'object'
       or pg_catalog.octet_length(v_fields_snapshot::text) > 100000 then
      raise exception using errcode = '22023', message = 'GRAPHIC_QUOTE_ITEM_INVALID';
    end if;

    select service.id, service.name, service.description, service.catalog_version
      into v_service
    from public.services as service
    where service.id = v_service_id
      and service.is_active
      and service.catalog_state = 'published'
      and service.deleted_at is null
      and service.commercial_mode = 'manual_quote'
    for key share;
    if not found then
      raise exception using errcode = '22023', message = 'SERVICE_UNAVAILABLE';
    end if;
    if v_service.catalog_version <> v_catalog_version then
      raise exception using errcode = '40001', message = 'SERVICE_CATALOG_CHANGED';
    end if;

    insert into public.order_items (
      order_id, service_id, product_id, service_name_snapshot,
      service_description_snapshot, product_name_snapshot, fields_snapshot,
      quantity, pages_count, pages_method, is_double_sided, unit_price_cents,
      total_price_cents, pricing_rule_id, pricing_rule_snapshot, discount_cents
    ) values (
      v_order_id, v_service.id, null, v_service.name, v_service.description,
      null, v_fields_snapshot, v_quantity, 0, 'pending_confirmation', false,
      0, 0, null, null, 0
    ) returning id into v_item_id;

    v_item_file_count := 0;
    for v_file_id in
      select value::uuid
      from jsonb_array_elements_text(v_item -> 'file_ids')
    loop
      update public.order_files as file
      set order_id = v_order_id, order_item_id = v_item_id
      where file.id = v_file_id
        and file.order_id is null
        and file.status = 'ready'
        and file.deleted_at is null
        and (file.expires_at is null or file.expires_at > now())
        and (
          (v_user_id is not null and file.user_id = v_user_id and file.guest_owner_hash is null)
          or
          (v_user_id is null and file.user_id is null and file.guest_owner_hash = p_guest_upload_session_hash)
        );
      get diagnostics v_linked_file_count = row_count;
      if v_linked_file_count <> 1 then
        raise exception using errcode = '42501', message = 'FILE_ACCESS_DENIED';
      end if;
      v_item_file_count := v_item_file_count + 1;
    end loop;

    select
      coalesce(sum(greatest(file.page_count, 1)), 0)::integer,
      case
        when bool_and(file.page_count_method = 'exact') then 'exact'::public.page_count_method
        else 'estimated'::public.page_count_method
      end
    into v_item_page_count, v_item_page_method
    from public.order_files as file
    where file.order_item_id = v_item_id;

    if v_item_file_count < 1 or v_item_page_count < 1 then
      raise exception using errcode = '22023', message = 'QUOTE_REQUEST_FILES_REQUIRED';
    end if;
    update public.order_items
    set pages_count = v_item_page_count,
        pages_method = v_item_page_method
    where id = v_item_id;
  end loop;

  select count(*) into v_total_linked_file_count
  from public.order_files as file
  where file.order_id = v_order_id;
  if v_total_linked_file_count <> v_expected_file_count
     or exists (
       select 1
       from unnest(p_file_ids) as expected_file_id
       left join public.order_files as file
         on file.id = expected_file_id and file.order_id = v_order_id
       where file.id is null
     ) then
    raise exception using errcode = '22023', message = 'FILE_ACCESS_DENIED';
  end if;

  insert into public.order_events (order_id, from_status, to_status, note)
  values (v_order_id, null, 'created', 'Solicitacao grafica criada para analise comercial');

  return query select v_order_id, v_order_number, v_order_code,
    'pending'::public.order_quote_status, false;
end;
$$;

revoke all on function public.commit_stationery_checkout(
  uuid, text, uuid, text, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_stationery_checkout(
  uuid, text, uuid, text, text, jsonb, jsonb
) to service_role;

revoke all on function public.commit_graphic_quote_request(
  uuid, text, uuid, text, text, jsonb, jsonb, uuid[]
) from public, anon, authenticated;
grant execute on function public.commit_graphic_quote_request(
  uuid, text, uuid, text, text, jsonb, jsonb, uuid[]
) to service_role;

comment on function public.commit_stationery_checkout(
  uuid, text, uuid, text, text, jsonb, jsonb
) is 'Checkout exclusivo de papelaria: revalida produto, preco e estoque no banco antes do commit.';

comment on function public.commit_graphic_quote_request(
  uuid, text, uuid, text, text, jsonb, jsonb, uuid[]
) is 'Cria solicitacao grafica sem preco, pagamento ou taxa; vincula arquivos com ownership atomico e idempotente.';

commit;
