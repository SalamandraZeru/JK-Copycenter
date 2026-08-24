\set ON_ERROR_STOP on

begin;

-- As correcoes estruturais precisam existir no banco real de staging.
do $$
declare
  issue_count integer;
begin
  select count(*) into issue_count
  from pg_policies
  where (coalesce(qual, '') ilike '%or true%' or coalesce(with_check, '') = 'true')
    and (schemaname = 'storage' or tablename in ('orders', 'order_items', 'order_files'));
  if issue_count <> 0 then
    raise exception 'P0 policies permissivas restantes: %', issue_count;
  end if;

  select count(*) into issue_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'storage')
    and p.prosecdef
    and p.proname in (
      'is_admin', 'get_admin_role', 'is_super_admin',
      'check_guest_order_access', 'handle_new_user',
      'create_order_transaction', 'mark_expired_files_as_deleted'
    );
  if issue_count <> 0 then
    raise exception 'SECURITY DEFINER internas ainda expostas: %', issue_count;
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'create_order_transaction', 'check_guest_order_access',
        'handle_new_user', 'mark_expired_files_as_deleted'
      )
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or has_function_privilege('service_role', p.oid, 'EXECUTE')
      )
  ) then
    raise exception 'funcao interna privilegiada ainda executavel por papel da API';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'order-files'
      and public = false
      and file_size_limit = 52428800
      and allowed_mime_types @> array['application/pdf', 'image/png']::text[]
  ) then
    raise exception 'bucket order-files sem privacidade/limites/MIME esperados';
  end if;
end;
$$;

-- Registros integralmente sinteticos e revertidos ao final.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','authenticated','authenticated','p0-a@example.test','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','authenticated','authenticated','p0-b@example.test','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()),
  ('00000000-0000-0000-0000-000000000000','cccccccc-cccc-4ccc-8ccc-cccccccccccc','authenticated','authenticated','p0-admin@example.test','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());

insert into public.admin_users (id, full_name, role, is_active)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'P0 Admin', 'admin', true);

insert into public.orders (
  id, order_number, user_id, idempotency_key, checkout_request_hash, checkout_actor_hash, payment_method
)
values
  ('a1000000-0000-4000-8000-000000000001','P0-A-1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a2000000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),'pix'),
  ('b1000000-0000-4000-8000-000000000001','P0-B-1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b2000000-0000-4000-8000-000000000001',repeat('c',64),repeat('d',64),'pix');

insert into public.order_files (
  id, order_id, user_id, original_name, storage_path, mime_type, file_type, ownership_version
) values
  ('a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a.pdf','orders/a.pdf','application/pdf','pdf',0),
  ('b3000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b.pdf','orders/b.pdf','application/pdf','pdf',0);

insert into storage.objects (id, bucket_id, name, owner, metadata)
values (
  'd1000000-0000-4000-8000-000000000001',
  'order-files',
  'p0/private-object.pdf',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '{"mimetype":"application/pdf","size":1}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  visible_orders integer;
  visible_files integer;
begin
  select count(*) into visible_orders from public.orders where order_number like 'P0-%';
  select count(*) into visible_files from public.order_files where original_name in ('a.pdf', 'b.pdf');
  if visible_orders <> 1 or visible_files <> 1 then
    raise exception 'cliente A atravessou ownership: orders %, files %', visible_orders, visible_files;
  end if;

  begin
    insert into public.orders (order_number, idempotency_key, payment_method)
    values ('P0-AUTH-DENIED', 'e1000000-0000-4000-8000-000000000001', 'pix');
    raise exception 'authenticated inseriu pedido diretamente';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
do $$
declare
  visible_orders integer;
  visible_admin_rows integer;
begin
  select count(*) into visible_orders from public.orders where order_number like 'P0-%';
  select count(*) into visible_admin_rows from public.admin_users;
  if visible_orders <> 0 or visible_admin_rows <> 1 then
    raise exception 'browser admin furou isolamento: orders %, own_admin_rows %', visible_orders, visible_admin_rows;
  end if;

  begin
    update public.admin_users set role = 'super_admin'
    where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    raise exception 'admin alterou role diretamente no browser';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;
reset role;

set local role anon;
do $$
declare
  catalog_rows integer;
  storage_rows integer;
  affected integer;
begin
  select count(*) into catalog_rows from public.categories where is_active;
  if catalog_rows = 0 then
    raise exception 'catalogo publico legitimo deixou de funcionar';
  end if;

  select count(*) into storage_rows
  from storage.objects
  where bucket_id = 'order-files' and name = 'p0/private-object.pdf';
  if storage_rows <> 0 then
    raise exception 'anon leu objeto privado';
  end if;

  begin
    insert into storage.objects (bucket_id, name)
    values ('order-files', 'p0/anon-insert.pdf');
    raise exception 'anon inseriu objeto privado';
  exception
    when insufficient_privilege then null;
  end;

  update storage.objects set name = 'p0/anon-update.pdf'
  where bucket_id = 'order-files' and name = 'p0/private-object.pdf';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'anon atualizou objeto privado';
  end if;

  begin
    delete from storage.objects
    where bucket_id = 'order-files' and name = 'p0/private-object.pdf';
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception 'anon removeu objeto privado';
    end if;
  exception
    when others then null;
  end;
end;
$$;
reset role;

set local role service_role;
do $$
declare
  storage_rows integer;
begin
  select count(*) into storage_rows
  from storage.objects
  where bucket_id = 'order-files' and name = 'p0/private-object.pdf';
  if storage_rows <> 1 then
    raise exception 'backend autorizado perdeu acesso ao objeto privado';
  end if;
end;
$$;
reset role;

rollback;

select 'P0_SECURITY_INTEGRATION_OK' as result;
