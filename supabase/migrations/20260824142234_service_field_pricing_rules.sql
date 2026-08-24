-- Regras de preço por campos reais do serviço.
-- As regras antigas por attribute_groups continuam íntegras para compatibilidade,
-- mas as novas condições são vinculadas exclusivamente aos service_fields.
create table public.pricing_rule_field_conditions (
  id uuid primary key default gen_random_uuid(),
  pricing_rule_id uuid not null references public.pricing_rules(id) on delete cascade,
  service_field_id uuid not null references public.service_fields(id) on delete restrict,
  -- SQL NULL é o coringa para o campo. Valores explícitos são escalares JSON.
  expected_value jsonb,
  created_at timestamptz not null default now(),
  constraint pricing_rule_field_conditions_one_per_field unique (pricing_rule_id, service_field_id),
  constraint pricing_rule_field_conditions_scalar_value check (
    expected_value is null
    or jsonb_typeof(expected_value) in ('string', 'number', 'boolean')
  )
);

create index pricing_rule_field_conditions_field_id_idx
  on public.pricing_rule_field_conditions(service_field_id);

alter table public.pricing_rule_field_conditions enable row level security;
revoke all on table public.pricing_rule_field_conditions from anon, authenticated, public;
grant select, insert, update, delete on table public.pricing_rule_field_conditions to service_role;

-- Garante que uma condição não seja associada a um campo de outro serviço,
-- mesmo em chamadas administrativas fora da interface.
create or replace function private.validate_pricing_rule_field_condition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rule_service_id uuid;
  v_field_service_id uuid;
begin
  select service_id into v_rule_service_id
  from public.pricing_rules
  where id = new.pricing_rule_id;

  select service_id into v_field_service_id
  from public.service_fields
  where id = new.service_field_id;

  if v_rule_service_id is null or v_field_service_id is null or v_rule_service_id <> v_field_service_id then
    raise exception using errcode = '23514', message = 'PRICING_RULE_FIELD_SERVICE_MISMATCH';
  end if;
  return new;
end;
$$;

create trigger pricing_rule_field_condition_service_guard
before insert or update on public.pricing_rule_field_conditions
for each row execute function private.validate_pricing_rule_field_condition();

-- A especificidade soma condições explícitas legadas e condições explícitas
-- por campo. Regras igualmente específicas que possam casar com a mesma
-- configuração permanecem proibidas, evitando preço não determinístico.
create or replace function private.assert_pricing_rule_unambiguous(p_rule_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_service_id uuid;
  v_is_active boolean;
  v_specificity integer;
begin
  select pr.service_id, pr.is_active,
    (
      select count(*)::integer
      from public.pricing_rule_attributes pra
      where pra.pricing_rule_id = pr.id
        and pra.attribute_id is not null
    ) + (
      select count(*)::integer
      from public.pricing_rule_field_conditions prfc
      where prfc.pricing_rule_id = pr.id
        and prfc.expected_value is not null
    )
  into v_service_id, v_is_active, v_specificity
  from public.pricing_rules pr
  where pr.id = p_rule_id;

  if not coalesce(v_is_active, false) then
    return;
  end if;

  if exists (
    select 1
    from public.pricing_rules other_rule
    where other_rule.service_id = v_service_id
      and other_rule.is_active
      and other_rule.id <> p_rule_id
      and (
        (
          select count(*)::integer
          from public.pricing_rule_attributes other_attr
          where other_attr.pricing_rule_id = other_rule.id
            and other_attr.attribute_id is not null
        ) + (
          select count(*)::integer
          from public.pricing_rule_field_conditions other_field
          where other_field.pricing_rule_id = other_rule.id
            and other_field.expected_value is not null
        )
      ) = v_specificity
      and not exists (
        select 1
        from public.pricing_rule_attributes candidate_attr
        join public.pricing_rule_attributes other_attr
          on other_attr.pricing_rule_id = other_rule.id
         and other_attr.attribute_group_id = candidate_attr.attribute_group_id
        where candidate_attr.pricing_rule_id = p_rule_id
          and candidate_attr.attribute_id is not null
          and other_attr.attribute_id is not null
          and candidate_attr.attribute_id <> other_attr.attribute_id
      )
      and not exists (
        select 1
        from public.pricing_rule_field_conditions candidate_field
        join public.pricing_rule_field_conditions other_field
          on other_field.pricing_rule_id = other_rule.id
         and other_field.service_field_id = candidate_field.service_field_id
        where candidate_field.pricing_rule_id = p_rule_id
          and candidate_field.expected_value is not null
          and other_field.expected_value is not null
          and candidate_field.expected_value is distinct from other_field.expected_value
      )
  ) then
    raise exception using errcode = '23505', message = 'AMBIGUOUS_PRICING_RULE';
  end if;
end;
$$;

create or replace function private.check_pricing_rule_field_conditions_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rule_id uuid := coalesce(new.pricing_rule_id, old.pricing_rule_id);
begin
  perform private.assert_pricing_rule_unambiguous(v_rule_id);
  return coalesce(new, old);
end;
$$;

create trigger pricing_rule_field_conditions_ambiguity_guard
after insert or update or delete on public.pricing_rule_field_conditions
for each row execute function private.check_pricing_rule_field_conditions_change();
