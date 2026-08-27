-- Complementa a Etapa 04: alterações em preço/configuração também produzem
-- uma versão comercial nova, sem alterar pedidos já confirmados.

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

create or replace function private.bump_binding_tier_pricing_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_service_id uuid := coalesce(new.service_id, old.service_id);
begin
  update public.services
  set pricing_version = pricing_version + 1
  where id = v_service_id;
  return coalesce(new, old);
end;
$$;

drop trigger if exists service_binding_price_tiers_pricing_version_bump on public.service_binding_price_tiers;
create trigger service_binding_price_tiers_pricing_version_bump
after insert or update or delete on public.service_binding_price_tiers
for each row execute function private.bump_binding_tier_pricing_version();
