-- Evita que a edição de um campo deixe vínculos entre opções apontando para
-- valores removidos ou inativos. O administrador remove os vínculos primeiro.
create or replace function private.prevent_invalid_service_field_dependency_options()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not new.is_active and exists (
    select 1
    from public.service_field_option_dependencies as dependency
    where dependency.source_field_id = new.id
       or dependency.target_field_id = new.id
  ) then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_DEPENDENCY_FIELD_STILL_REFERENCED';
  end if;

  if new.options is distinct from old.options and exists (
    select 1
    from public.service_field_option_dependencies as dependency
    where (
      dependency.source_field_id = new.id
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(new.options, '[]'::jsonb)) as option_row(value)
        where option_row.value ->> 'value' = dependency.source_option_value
          and coalesce((option_row.value ->> 'is_active')::boolean, true)
      )
    ) or (
      dependency.target_field_id = new.id
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(new.options, '[]'::jsonb)) as option_row(value)
        where option_row.value ->> 'value' = dependency.target_option_value
          and coalesce((option_row.value ->> 'is_active')::boolean, true)
      )
    )
  ) then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_DEPENDENCY_OPTION_STILL_REFERENCED';
  end if;

  return new;
end;
$$;

create trigger service_field_dependency_option_protection
before update of options, is_active on public.service_fields
for each row execute function private.prevent_invalid_service_field_dependency_options();
