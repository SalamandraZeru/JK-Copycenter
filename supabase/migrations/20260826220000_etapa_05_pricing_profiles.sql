-- ETAPA 05 — perfis técnicos de cobrança por serviço.
-- Os valores continuam canônicos em centavos; o perfil apenas define como a
-- unidade é medida. Configurações não cobertas são recusadas no servidor.

alter table public.services
  add column if not exists pricing_profile text not null default 'per_page',
  add column if not exists pricing_profile_config jsonb not null default '{}'::jsonb;

alter table public.services
  drop constraint if exists services_pricing_profile_valid,
  add constraint services_pricing_profile_valid check (
    pricing_profile in (
      'per_page',
      'per_item',
      'per_sheet',
      'per_square_meter',
      'per_linear_meter',
      'binding_by_file_pages',
      'booklet_imposition',
      'manual_quote'
    )
  ),
  drop constraint if exists services_pricing_profile_config_object,
  add constraint services_pricing_profile_config_object check (jsonb_typeof(pricing_profile_config) = 'object');

create or replace function private.bump_service_profile_pricing_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if row(new.pricing_profile, new.pricing_profile_config)
     is distinct from row(old.pricing_profile, old.pricing_profile_config) then
    new.pricing_version := old.pricing_version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists services_pricing_profile_versioning on public.services;
create trigger services_pricing_profile_versioning
before update on public.services
for each row execute function private.bump_service_profile_pricing_version();

create or replace function private.version_service_catalog()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.catalog_version := coalesce(new.catalog_version, 1);
    return new;
  end if;

  if row(
    new.name,
    new.slug,
    new.description,
    new.image_url,
    new.base_price_cents,
    new.pricing_fallback_behavior,
    new.pricing_profile,
    new.pricing_profile_config,
    new.pricing_version,
    new.catalog_state,
    new.is_active,
    new.sort_order,
    new.deleted_at
  ) is distinct from row(
    old.name,
    old.slug,
    old.description,
    old.image_url,
    old.base_price_cents,
    old.pricing_fallback_behavior,
    old.pricing_profile,
    old.pricing_profile_config,
    old.pricing_version,
    old.catalog_state,
    old.is_active,
    old.sort_order,
    old.deleted_at
  ) then
    new.catalog_version := old.catalog_version + 1;
  end if;

  return new;
end;
$$;

comment on column public.services.pricing_profile is
  'Unidade técnica de cobrança aplicada pelo motor no servidor.';
comment on column public.services.pricing_profile_config is
  'Restrições técnicas não monetárias do perfil, como páginas por folha ou múltiplo de imposição.';
