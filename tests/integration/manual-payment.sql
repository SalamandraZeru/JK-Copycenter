\set ON_ERROR_STOP on

begin;

do $$
declare
  v_order_id uuid := 'f1000000-0000-4000-8000-000000000001';
  v_admin_id uuid := 'f2000000-0000-4000-8000-000000000001';
  v_payment_key uuid := 'f3000000-0000-4000-8000-000000000001';
  v_status_key uuid := 'f4000000-0000-4000-8000-000000000001';
  v_status public.order_status;
  v_payment public.payment_status;
begin
  if not exists (select 1 from pg_enum where enumtypid = 'public.order_status'::regtype and enumlabel = 'awaiting_payment')
     or not exists (select 1 from pg_enum where enumtypid = 'public.payment_status'::regtype and enumlabel = 'pending_contact') then
    raise exception 'ETAPA_06 enum states missing';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated',
    'etapa06-admin@example.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );
  insert into public.admin_users (id, full_name, role, is_active)
  values (v_admin_id, 'ETAPA_06 Admin', 'admin', true);
  insert into public.orders (
    id, order_number, idempotency_key, checkout_request_hash, checkout_actor_hash,
    payment_method, status, payment_status
  ) values (
    v_order_id, 'ETAPA-06-LOCAL', 'f5000000-0000-4000-8000-000000000001', repeat('a', 64), repeat('b', 64),
    'pix', 'awaiting_payment', 'pending_contact'
  );

  perform public.process_manual_payment(v_order_id, v_admin_id, 'paid', 'Pagamento manual conferido.', 'ETAPA06-REF', v_payment_key);
  select status, payment_status into v_status, v_payment from public.orders where id = v_order_id;
  if v_status <> 'confirmed' or v_payment <> 'paid' then
    raise exception 'ETAPA_06 payment confirmation state invalid: %, %', v_status, v_payment;
  end if;
  if (select count(*) from public.order_payment_events where order_id = v_order_id) <> 1
     or (select count(*) from public.audit_logs where entity_id = v_order_id and action = 'process_manual_payment') <> 1 then
    raise exception 'ETAPA_06 payment event or audit missing';
  end if;

  perform public.process_manual_payment(v_order_id, v_admin_id, 'paid', 'Pagamento manual conferido.', 'ETAPA06-REF', v_payment_key);
  if (select count(*) from public.order_payment_events where order_id = v_order_id) <> 1 then
    raise exception 'ETAPA_06 payment idempotency failed';
  end if;
  perform public.transition_order_status(v_order_id, v_admin_id, 'in_production', 'Liberado para produção.', v_status_key, false);
  if (select status from public.orders where id = v_order_id) <> 'in_production' then
    raise exception 'ETAPA_06 authorized production transition failed';
  end if;
end;
$$;

do $$
begin
  if has_function_privilege('anon', 'public.process_manual_payment(uuid,uuid,text,text,text,uuid)'::regprocedure, 'EXECUTE')
     or has_function_privilege('authenticated', 'public.process_manual_payment(uuid,uuid,text,text,text,uuid)'::regprocedure, 'EXECUTE')
     or has_function_privilege('anon', 'public.transition_order_status(uuid,uuid,public.order_status,text,uuid,boolean)'::regprocedure, 'EXECUTE')
     or has_function_privilege('authenticated', 'public.transition_order_status(uuid,uuid,public.order_status,text,uuid,boolean)'::regprocedure, 'EXECUTE') then
    raise exception 'ETAPA_06 privileged payment/order RPC exposed to browser roles';
  end if;
end;
$$;

rollback;

select 'ETAPA_06_PAYMENT_DATABASE_OK' as result;
