begin;

-- A chave de idempotência é escopada ao ator do checkout. O hash do request
-- deixa de ser um trecho de notes e passa a ser um atributo verificável.
alter table public.orders
  add column if not exists checkout_request_hash text,
  add column if not exists checkout_actor_hash text;

update public.orders
set
  checkout_request_hash = coalesce(
    checkout_request_hash,
    encode(extensions.digest('legacy-request:' || id::text, 'sha256'), 'hex')
  ),
  checkout_actor_hash = coalesce(
    checkout_actor_hash,
    encode(
      extensions.digest(
        case
          when user_id is not null then 'user:' || user_id::text
          when guest_email is not null then 'guest:' || lower(btrim(guest_email))
          else 'legacy:' || id::text
        end,
        'sha256'
      ),
      'hex'
    )
  );

alter table public.orders
  alter column checkout_request_hash set not null,
  alter column checkout_actor_hash set not null,
  drop constraint if exists orders_checkout_request_hash_format,
  drop constraint if exists orders_checkout_actor_hash_format,
  add constraint orders_checkout_request_hash_format
    check (checkout_request_hash ~ '^[a-f0-9]{64}$'),
  add constraint orders_checkout_actor_hash_format
    check (checkout_actor_hash ~ '^[a-f0-9]{64}$');

alter table public.orders
  drop constraint if exists orders_idempotency_key_key;

create unique index if not exists orders_checkout_idempotency_actor_key
  on public.orders (checkout_actor_hash, idempotency_key);

-- O gerador sequencial não deve continuar como caminho de pedidos públicos.
-- O antigo checkout já havia sido removido da API; estes objetos não possuem
-- mais chamadores após esta migration.
drop function if exists public.next_order_number();
drop function if exists private.create_order_transaction(jsonb, jsonb, jsonb, jsonb);

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
    if v_expected_file_count > 0
       and coalesce(p_guest_upload_session_hash, '') !~ '^[a-f0-9]{64}$' then
      raise exception using errcode = '22023', message = 'FILE_ACCESS_DENIED';
    end if;
  end if;

  if jsonb_typeof(p_order) <> 'object' or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'CHECKOUT_PAYLOAD_INVALID';
  end if;

  -- Serializa somente tentativas com a mesma chave e ator. Isto fecha a janela
  -- entre o SELECT de replay e o INSERT mesmo sob requisições simultâneas.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor_hash || ':' || p_idempotency_key::text, 0)
  );

  select *
  into v_existing
  from public.orders
  where checkout_actor_hash = v_actor_hash
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing.checkout_request_hash <> p_request_hash then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      v_existing.id,
      v_existing.order_number,
      v_existing.order_token,
      v_existing.total_cents,
      v_existing.payment_method,
      true;
    return;
  end if;

  v_delivery_type := (p_order ->> 'delivery_type')::public.delivery_type;
  v_payment_method := (p_order ->> 'payment_method')::public.payment_method;
  v_delivery_address := p_order -> 'delivery_address_snapshot';
  v_delivery_fee_cents := (p_order ->> 'delivery_fee_cents')::bigint;
  v_subtotal_cents := (p_order ->> 'subtotal_cents')::bigint;
  v_total_cents := (p_order ->> 'total_cents')::bigint;

  if v_delivery_fee_cents < 0 or v_subtotal_cents < 0
     or v_total_cents <> v_delivery_fee_cents + v_subtotal_cents then
    raise exception using errcode = '22023', message = 'CHECKOUT_TOTAL_INVALID';
  end if;

  if v_delivery_type = 'delivery' and jsonb_typeof(v_delivery_address) <> 'object' then
    raise exception using errcode = '22023', message = 'DELIVERY_ADDRESS_REQUIRED';
  end if;

  if v_user_id is null then
    select (value #>> '{}')::integer
    into v_guest_access_days
    from public.store_settings
    where key = 'guest_order_access_days';

    if v_guest_access_days is null or v_guest_access_days < 1 then
      raise exception using errcode = '22023', message = 'CONFIG_UNAVAILABLE: guest_order_access_days';
    end if;
  end if;

  select count(distinct file_id)
  into v_distinct_file_count
  from unnest(coalesce(p_file_ids, '{}'::uuid[])) as file_id;
  if v_distinct_file_count <> v_expected_file_count then
    raise exception using errcode = '22023', message = 'FILE_ACCESS_DENIED';
  end if;

  v_order_id := pg_catalog.gen_random_uuid();
  v_order_code := pg_catalog.gen_random_uuid();
  v_order_number := format(
    'JK-%s-%s',
    extract(year from current_date)::text,
    upper(substr(replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 12))
  );

  insert into public.orders (
    id,
    order_number,
    order_token,
    user_id,
    guest_email,
    guest_name,
    guest_phone,
    guest_access_expires_at,
    idempotency_key,
    checkout_request_hash,
    checkout_actor_hash,
    status,
    delivery_type,
    delivery_address_snapshot,
    delivery_fee_cents,
    subtotal_cents,
    total_cents,
    payment_method,
    payment_status,
    pix_key_used,
    notes
  ) values (
    v_order_id,
    v_order_number,
    v_order_code,
    v_user_id,
    v_guest_email,
    nullif(btrim(p_order ->> 'guest_name'), ''),
    nullif(btrim(p_order ->> 'guest_phone'), ''),
    case when v_user_id is null then now() + make_interval(days => v_guest_access_days) else null end,
    p_idempotency_key,
    p_request_hash,
    v_actor_hash,
    'new',
    v_delivery_type,
    v_delivery_address,
    v_delivery_fee_cents,
    v_subtotal_cents,
    v_total_cents,
    v_payment_method,
    'pending',
    nullif(p_order ->> 'pix_key_used', ''),
    nullif(btrim(p_order ->> 'notes'), '')
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception using errcode = '22023', message = 'CHECKOUT_ITEM_INVALID';
    end if;

    v_service_id := nullif(v_item ->> 'service_id', '')::uuid;
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    if (v_service_id is null) = (v_product_id is null) then
      raise exception using errcode = '22023', message = 'CHECKOUT_ITEM_INVALID';
    end if;

    v_quantity := (v_item ->> 'quantity')::integer;
    v_pages_count := coalesce((v_item ->> 'pages_count')::integer, 0);
    v_pages_method := coalesce((v_item ->> 'pages_method')::public.page_count_method, 'exact');
    v_is_double_sided := coalesce((v_item ->> 'is_double_sided')::boolean, false);
    v_unit_price_cents := (v_item ->> 'unit_price_cents')::bigint;
    v_item_total_cents := (v_item ->> 'total_price_cents')::bigint;
    v_discount_cents := coalesce((v_item ->> 'discount_cents')::bigint, 0);
    v_pricing_rule_id := nullif(v_item ->> 'pricing_rule_id', '')::uuid;

    if v_quantity < 1 or v_pages_count < 0 or v_unit_price_cents < 0
       or v_item_total_cents < 0 or v_discount_cents < 0 then
      raise exception using errcode = '22023', message = 'CHECKOUT_ITEM_INVALID';
    end if;
    v_items_total_cents := v_items_total_cents + v_item_total_cents;

    insert into public.order_items (
      order_id,
      service_id,
      product_id,
      service_name_snapshot,
      service_description_snapshot,
      product_name_snapshot,
      fields_snapshot,
      quantity,
      pages_count,
      pages_method,
      is_double_sided,
      unit_price_cents,
      total_price_cents,
      pricing_rule_id,
      pricing_rule_snapshot,
      discount_cents
    ) values (
      v_order_id,
      v_service_id,
      v_product_id,
      nullif(v_item ->> 'service_name_snapshot', ''),
      nullif(v_item ->> 'service_description_snapshot', ''),
      nullif(v_item ->> 'product_name_snapshot', ''),
      coalesce(v_item -> 'fields_snapshot', '{}'::jsonb),
      v_quantity,
      v_pages_count,
      v_pages_method,
      v_is_double_sided,
      v_unit_price_cents,
      v_item_total_cents,
      v_pricing_rule_id,
      v_item -> 'pricing_rule_snapshot',
      v_discount_cents
    ) returning id into v_item_id;

    if coalesce(v_item -> 'file_ids', '[]'::jsonb) <> '[]'::jsonb
       and jsonb_typeof(v_item -> 'file_ids') <> 'array' then
      raise exception using errcode = '22023', message = 'CHECKOUT_ITEM_INVALID';
    end if;

    for v_file_id in
      select value::uuid
      from jsonb_array_elements_text(coalesce(v_item -> 'file_ids', '[]'::jsonb))
    loop
      update public.order_files as file
      set order_id = v_order_id,
          order_item_id = v_item_id
      where file.id = v_file_id
        and file.order_id is null
        and file.status = 'ready'
        and file.deleted_at is null
        and (file.expires_at is null or file.expires_at > now())
        and (
          (v_user_id is not null and file.user_id = v_user_id and file.guest_owner_hash is null)
          or (
            v_user_id is null
            and file.user_id is null
            and file.guest_owner_hash = p_guest_upload_session_hash
          )
        );

      get diagnostics v_linked_file_count = row_count;
      if v_linked_file_count <> 1 then
        raise exception using errcode = '42501', message = 'FILE_ACCESS_DENIED';
      end if;
    end loop;
  end loop;

  if v_items_total_cents <> v_subtotal_cents then
    raise exception using errcode = '22023', message = 'CHECKOUT_TOTAL_INVALID';
  end if;

  select count(*) into v_total_linked_file_count
  from public.order_files as file
  where file.order_id = v_order_id;
  if v_total_linked_file_count <> v_expected_file_count then
    raise exception using errcode = '22023', message = 'FILE_ACCESS_DENIED';
  end if;

  if v_expected_file_count > 0 and exists (
    select 1
    from unnest(p_file_ids) as expected_file_id
    left join public.order_files as file
      on file.id = expected_file_id and file.order_id = v_order_id
    where file.id is null
  ) then
    raise exception using errcode = '22023', message = 'FILE_ACCESS_DENIED';
  end if;

  insert into public.order_events (order_id, from_status, to_status, note)
  values (v_order_id, null, 'new', 'Pedido criado no checkout transacional');

  return query select v_order_id, v_order_number, v_order_code, v_total_cents, v_payment_method, false;
end;
$$;

revoke all on function public.commit_checkout(uuid, text, uuid, text, text, jsonb, jsonb, uuid[])
  from public, anon, authenticated;
grant execute on function public.commit_checkout(uuid, text, uuid, text, text, jsonb, jsonb, uuid[])
  to service_role;

comment on function public.commit_checkout(uuid, text, uuid, text, text, jsonb, jsonb, uuid[]) is
  'Commit atomico de checkout para backend service_role: idempotencia por ator, vinculo autorizado de arquivos, pedido, itens e evento.';

commit;
