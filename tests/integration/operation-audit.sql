\set ON_ERROR_STOP on

begin;

do $$
declare
  v_admin_id uuid := 'f7000000-0000-4000-8000-000000000001';
  v_old_value jsonb;
  v_old_audit jsonb;
  v_new_audit jsonb;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated',
    'etapa07-admin@example.test', '', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );
  insert into public.admin_users (id, full_name, role, is_active)
  values (v_admin_id, 'ETAPA_07 Admin', 'super_admin', true);

  select value into v_old_value from public.store_settings where key = 'pix_key';
  if v_old_value is null then raise exception 'ETAPA_07 sensitive store setting fixture missing'; end if;
  update public.store_settings
  set value = v_old_value,
      updated_by = v_admin_id
  where key = 'pix_key';

  select old_value, new_value into v_old_audit, v_new_audit
  from public.audit_logs
  where action = 'update_store_setting'
    and admin_user_id = v_admin_id
  order by created_at desc
  limit 1;
  if v_old_audit #>> '{value}' <> '[REDACTED]'
     or v_new_audit #>> '{value}' <> '[REDACTED]' then
    raise exception 'ETAPA_07 sensitive setting audit is not redacted';
  end if;

  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'audit_logs_created_at_desc_idx')
     or not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'audit_logs_entity_created_at_desc_idx') then
    raise exception 'ETAPA_07 audit operational indexes missing';
  end if;
end;
$$;

rollback;

select 'ETAPA_07_OPERATION_DATABASE_OK' as result;
