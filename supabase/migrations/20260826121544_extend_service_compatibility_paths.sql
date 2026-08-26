-- Caminhos de compatibilidade entre campos do mesmo serviço.
-- Uma regra pode ter vários antecedentes, por exemplo:
--   Tamanho=A4 + Papel=adesivo -> Frente e verso=false
-- A coluna legada source_* continua preenchida com o primeiro antecedente para
-- manter a compatibilidade com dados e integrações já existentes.

alter table public.service_field_option_dependencies
  add column source_conditions jsonb not null default '[]'::jsonb;

update public.service_field_option_dependencies
set source_conditions = jsonb_build_array(
  jsonb_build_object(
    'field_id', source_field_id,
    'option_value', source_option_value
  )
)
where source_conditions = '[]'::jsonb;

alter table public.service_field_option_dependencies
  add constraint service_field_option_dependencies_source_conditions_valid
  check (
    jsonb_typeof(source_conditions) = 'array'
    and jsonb_array_length(source_conditions) > 0
  );

alter table public.service_field_option_dependencies
  drop constraint service_field_option_dependencies_unique_link;

alter table public.service_field_option_dependencies
  add constraint service_field_option_dependencies_unique_path
  unique (service_id, target_field_id, target_option_value, source_conditions);

create index service_field_option_dependencies_conditions_lookup_idx
  on public.service_field_option_dependencies
  using gin (source_conditions jsonb_path_ops);

create or replace function private.validate_service_field_option_dependency()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_condition jsonb;
  v_condition_field_id uuid;
  v_condition_option_value text;
  v_condition_service_id uuid;
  v_condition_type public.field_type;
  v_condition_options jsonb;
  v_target_service_id uuid;
  v_target_type public.field_type;
  v_target_options jsonb;
  v_seen_field_ids uuid[] := array[]::uuid[];
  v_position integer := 0;
begin
  if jsonb_typeof(new.source_conditions) <> 'array'
     or jsonb_array_length(new.source_conditions) = 0 then
    -- Permite que a rota legada ainda informe somente source_*.
    new.source_conditions := jsonb_build_array(
      jsonb_build_object(
        'field_id', new.source_field_id,
        'option_value', new.source_option_value
      )
    );
  end if;

  if jsonb_typeof(new.source_conditions) <> 'array'
     or jsonb_array_length(new.source_conditions) = 0 then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_COMPATIBILITY_CONDITIONS_INVALID';
  end if;

  for v_condition in
    select value from jsonb_array_elements(new.source_conditions)
  loop
    v_position := v_position + 1;
    if jsonb_typeof(v_condition) <> 'object'
       or coalesce(v_condition ->> 'field_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or nullif(btrim(v_condition ->> 'option_value'), '') is null
       or char_length(btrim(v_condition ->> 'option_value')) > 200 then
      raise exception using errcode = '23514', message = 'SERVICE_FIELD_COMPATIBILITY_CONDITION_INVALID';
    end if;

    v_condition_field_id := (v_condition ->> 'field_id')::uuid;
    v_condition_option_value := btrim(v_condition ->> 'option_value');
    if v_condition_field_id = any(v_seen_field_ids) then
      raise exception using errcode = '23514', message = 'SERVICE_FIELD_COMPATIBILITY_CONDITION_DUPLICATE_FIELD';
    end if;
    v_seen_field_ids := array_append(v_seen_field_ids, v_condition_field_id);

    select service_id, field_type, options
      into v_condition_service_id, v_condition_type, v_condition_options
    from public.service_fields
    where id = v_condition_field_id and is_active;

    if v_condition_service_id is null or v_condition_service_id <> new.service_id then
      raise exception using errcode = '23514', message = 'SERVICE_FIELD_COMPATIBILITY_SERVICE_MISMATCH';
    end if;

    if v_condition_type not in ('select', 'radio', 'checkbox') then
      raise exception using errcode = '23514', message = 'SERVICE_FIELD_COMPATIBILITY_OPTION_FIELD_REQUIRED';
    end if;

    if v_condition_type = 'checkbox' then
      if v_condition_option_value not in ('true', 'false') then
        raise exception using errcode = '23514', message = 'SERVICE_FIELD_COMPATIBILITY_CHECKBOX_VALUE_INVALID';
      end if;
    elsif not exists (
      select 1
      from jsonb_array_elements(coalesce(v_condition_options, '[]'::jsonb)) as option_row(value)
      where option_row.value ->> 'value' = v_condition_option_value
        and coalesce((option_row.value ->> 'is_active')::boolean, true)
    ) then
      raise exception using errcode = '23514', message = 'SERVICE_FIELD_COMPATIBILITY_SOURCE_OPTION_INVALID';
    end if;

    if v_position = 1 then
      new.source_field_id := v_condition_field_id;
      new.source_option_value := v_condition_option_value;
    end if;
  end loop;

  if new.target_field_id = any(v_seen_field_ids) then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_COMPATIBILITY_TARGET_IN_CONDITIONS';
  end if;

  select service_id, field_type, options
    into v_target_service_id, v_target_type, v_target_options
  from public.service_fields
  where id = new.target_field_id and is_active;

  if v_target_service_id is null or v_target_service_id <> new.service_id then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_COMPATIBILITY_SERVICE_MISMATCH';
  end if;

  if v_target_type not in ('select', 'radio', 'checkbox') then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_COMPATIBILITY_OPTION_FIELD_REQUIRED';
  end if;

  new.target_option_value := btrim(new.target_option_value);
  if v_target_type = 'checkbox' then
    if new.target_option_value not in ('true', 'false') then
      raise exception using errcode = '23514', message = 'SERVICE_FIELD_COMPATIBILITY_CHECKBOX_VALUE_INVALID';
    end if;
  elsif not exists (
    select 1
    from jsonb_array_elements(coalesce(v_target_options, '[]'::jsonb)) as option_row(value)
    where option_row.value ->> 'value' = new.target_option_value
      and coalesce((option_row.value ->> 'is_active')::boolean, true)
  ) then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_COMPATIBILITY_TARGET_OPTION_INVALID';
  end if;

  return new;
end;
$$;

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
    where dependency.target_field_id = new.id
       or exists (
         select 1
         from jsonb_array_elements(dependency.source_conditions) as condition_row(value)
         where condition_row.value ->> 'field_id' = new.id::text
       )
  ) then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_DEPENDENCY_FIELD_STILL_REFERENCED';
  end if;

  if new.options is distinct from old.options and new.field_type <> 'checkbox' and exists (
    select 1
    from public.service_field_option_dependencies as dependency
    where (
      dependency.target_field_id = new.id
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(new.options, '[]'::jsonb)) as option_row(value)
        where option_row.value ->> 'value' = dependency.target_option_value
          and coalesce((option_row.value ->> 'is_active')::boolean, true)
      )
    ) or exists (
      select 1
      from jsonb_array_elements(dependency.source_conditions) as condition_row(value)
      where condition_row.value ->> 'field_id' = new.id::text
        and not exists (
          select 1
          from jsonb_array_elements(coalesce(new.options, '[]'::jsonb)) as option_row(value)
          where option_row.value ->> 'value' = condition_row.value ->> 'option_value'
            and coalesce((option_row.value ->> 'is_active')::boolean, true)
        )
    )
  ) then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_DEPENDENCY_OPTION_STILL_REFERENCED';
  end if;

  return new;
end;
$$;

create or replace function public.replace_service_field_option_dependencies(
  p_service_id uuid,
  p_root_field_id uuid,
  p_root_option_value text,
  p_dependencies jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_root_type public.field_type;
  v_root_options jsonb;
  v_rule jsonb;
  v_source_conditions jsonb;
  v_target_field_id uuid;
  v_target_option_value text;
  v_root_condition jsonb := jsonb_build_object(
    'field_id', p_root_field_id,
    'option_value', btrim(p_root_option_value)
  );
  v_inserted integer := 0;
begin
  if jsonb_typeof(p_dependencies) <> 'array' then
    raise exception using errcode = '22023', message = 'SERVICE_FIELD_COMPATIBILITY_TREE_INVALID';
  end if;

  select field_type, options
    into v_root_type, v_root_options
  from public.service_fields
  where id = p_root_field_id
    and service_id = p_service_id
    and is_active;

  if v_root_type is null or v_root_type not in ('select', 'radio', 'checkbox') then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_COMPATIBILITY_ROOT_INVALID';
  end if;

  if v_root_type = 'checkbox' then
    if btrim(p_root_option_value) not in ('true', 'false') then
      raise exception using errcode = '23514', message = 'SERVICE_FIELD_COMPATIBILITY_CHECKBOX_VALUE_INVALID';
    end if;
  elsif not exists (
    select 1
    from jsonb_array_elements(coalesce(v_root_options, '[]'::jsonb)) as option_row(value)
    where option_row.value ->> 'value' = btrim(p_root_option_value)
      and coalesce((option_row.value ->> 'is_active')::boolean, true)
  ) then
    raise exception using errcode = '23514', message = 'SERVICE_FIELD_COMPATIBILITY_ROOT_OPTION_INVALID';
  end if;

  -- A função executa em uma única transação: se uma nova regra falhar na
  -- validação do trigger, esta remoção também é desfeita automaticamente.
  delete from public.service_field_option_dependencies
  where service_id = p_service_id
    and source_conditions @> jsonb_build_array(v_root_condition);

  for v_rule in select value from jsonb_array_elements(p_dependencies)
  loop
    v_source_conditions := v_rule -> 'source_conditions';
    if jsonb_typeof(v_source_conditions) <> 'array'
       or jsonb_array_length(v_source_conditions) = 0
       or not (v_source_conditions @> jsonb_build_array(v_root_condition))
       or coalesce(v_rule ->> 'target_field_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or nullif(btrim(v_rule ->> 'target_option_value'), '') is null then
      raise exception using errcode = '22023', message = 'SERVICE_FIELD_COMPATIBILITY_TREE_INVALID';
    end if;

    v_target_field_id := (v_rule ->> 'target_field_id')::uuid;
    v_target_option_value := btrim(v_rule ->> 'target_option_value');

    insert into public.service_field_option_dependencies (
      service_id,
      source_field_id,
      source_option_value,
      source_conditions,
      target_field_id,
      target_option_value
    ) values (
      p_service_id,
      (v_source_conditions -> 0 ->> 'field_id')::uuid,
      v_source_conditions -> 0 ->> 'option_value',
      v_source_conditions,
      v_target_field_id,
      v_target_option_value
    );
    v_inserted := v_inserted + 1;
  end loop;

  return v_inserted;
end;
$$;

revoke all on function public.replace_service_field_option_dependencies(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_service_field_option_dependencies(uuid, uuid, text, jsonb)
  to service_role;

comment on column public.service_field_option_dependencies.source_conditions is
  'Condições cumulativas que precisam ser selecionadas para liberar a opção de destino.';
comment on function public.replace_service_field_option_dependencies(uuid, uuid, text, jsonb) is
  'Substitui atomicamente a árvore de compatibilidades de uma opção raiz; executável somente pelo backend com service_role.';
