begin;

-- Store settings are critical operational inputs. The trigger stays in the
-- same transaction as the change: if audit insertion fails, the setting must
-- not be persisted. Historical values of sensitive settings are redacted in
-- both directions.
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
    case when tg_op = 'UPDATE' then jsonb_build_object(
      'key', old.key,
      'value', case when old.is_sensitive then '"[REDACTED]"'::jsonb else old.value end
    ) else null end,
    jsonb_build_object(
      'key', new.key,
      'value', case when new.is_sensitive then '"[REDACTED]"'::jsonb else new.value end
    )
  );
  return new;
end;
$$;

create index if not exists audit_logs_created_at_desc_idx
  on public.audit_logs (created_at desc);

create index if not exists audit_logs_entity_created_at_desc_idx
  on public.audit_logs (entity, created_at desc);

comment on function private.audit_store_setting_change() is
  'Audita configuracoes na mesma transacao e nunca grava valores sensiveis no historico.';

commit;
