begin;

-- O aceite comercial continua usando a função versionada da Etapa 2. Este
-- wrapper registra as escolhas de pagamento e logística na mesma transação,
-- evitando que um orçamento aceito fique sem o próximo passo operacional.
create or replace function public.accept_order_quote_with_fulfillment(
  p_order_id uuid,
  p_quote_id uuid,
  p_expected_quote_version integer,
  p_actor_user_id uuid,
  p_guest_order_token uuid,
  p_idempotency_key uuid,
  p_request_hash text,
  p_payment_method public.payment_method,
  p_delivery_type public.delivery_type,
  p_delivery_address jsonb
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
  v_result record;
begin
  if p_payment_method is null or p_delivery_type is null then
    raise exception using errcode = '22023', message = 'QUOTE_FULFILLMENT_INVALID';
  end if;

  if p_delivery_type = 'delivery' then
    if jsonb_typeof(p_delivery_address) <> 'object'
       or nullif(btrim(p_delivery_address ->> 'street'), '') is null
       or nullif(btrim(p_delivery_address ->> 'number'), '') is null
       or nullif(btrim(p_delivery_address ->> 'neighborhood'), '') is null
       or nullif(btrim(p_delivery_address ->> 'city'), '') is null
       or (p_delivery_address ->> 'state') !~ '^[A-Z]{2}$'
       or (p_delivery_address ->> 'zipCode') !~ '^[0-9]{8}$' then
      raise exception using errcode = '22023', message = 'QUOTE_DELIVERY_ADDRESS_INVALID';
    end if;
  elsif p_delivery_address is not null then
    raise exception using errcode = '22023', message = 'QUOTE_PICKUP_ADDRESS_NOT_ALLOWED';
  end if;

  select * into v_result
  from public.accept_order_quote(
    p_order_id,
    p_quote_id,
    p_expected_quote_version,
    p_actor_user_id,
    p_guest_order_token,
    p_idempotency_key,
    p_request_hash
  );

  update public.orders
  set payment_method = p_payment_method,
      delivery_type = p_delivery_type,
      delivery_address_snapshot = case
        when p_delivery_type = 'delivery' then p_delivery_address
        else null
      end,
      updated_at = now()
  where id = p_order_id;

  return query select
    v_result.order_id,
    v_result.quote_id,
    v_result.quote_version,
    v_result.quote_status,
    v_result.total_cents,
    v_result.replayed;
end;
$$;

revoke all on function public.accept_order_quote_with_fulfillment(
  uuid, uuid, integer, uuid, uuid, uuid, text,
  public.payment_method, public.delivery_type, jsonb
) from public, anon, authenticated;

grant execute on function public.accept_order_quote_with_fulfillment(
  uuid, uuid, integer, uuid, uuid, uuid, text,
  public.payment_method, public.delivery_type, jsonb
) to service_role;

comment on function public.accept_order_quote_with_fulfillment(
  uuid, uuid, integer, uuid, uuid, uuid, text,
  public.payment_method, public.delivery_type, jsonb
) is 'Aceita a versão vigente e registra pagamento/logística na mesma transação; disponível somente ao service_role.';

commit;
