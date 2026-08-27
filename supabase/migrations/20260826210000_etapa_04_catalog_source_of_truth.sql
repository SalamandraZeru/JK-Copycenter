-- ETAPA 04 — catálogo comercial versionado, auditável e com publicação explícita.
-- O catálogo publicado continua no Supabase: não há fixture de código no runtime.

do $$
begin
  create type public.catalog_state as enum ('draft', 'review', 'published', 'inactive');
exception
  when duplicate_object then null;
end
$$;

alter table public.services
  add column if not exists catalog_state public.catalog_state not null default 'draft',
  add column if not exists catalog_version bigint not null default 1,
  add column if not exists catalog_updated_by uuid references public.admin_users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists published_at timestamptz;

-- Preserva a disponibilidade atual do catálogo quando a migração é promovida.
update public.services
set
  catalog_state = case
    when deleted_at is not null then 'inactive'::public.catalog_state
    when is_active then 'published'::public.catalog_state
    else 'draft'::public.catalog_state
  end,
  is_active = case when deleted_at is not null then false else is_active end;

alter table public.services
  drop constraint if exists services_catalog_state_is_active_consistent,
  add constraint services_catalog_version_positive check (catalog_version >= 1),
  add constraint services_catalog_state_is_active_consistent check (
    (catalog_state = 'published' and is_active and deleted_at is null)
    or (catalog_state <> 'published' and not is_active)
  );

create table if not exists public.service_catalog_versions (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  catalog_version bigint not null check (catalog_version >= 1),
  catalog_state public.catalog_state not null,
  snapshot jsonb not null,
  changed_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (service_id, catalog_version)
);

create index if not exists service_catalog_versions_service_created_idx
  on public.service_catalog_versions (service_id, created_at desc);

alter table public.service_catalog_versions enable row level security;
revoke all on table public.service_catalog_versions from public, anon, authenticated;
grant select, insert on table public.service_catalog_versions to service_role;

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

drop trigger if exists services_catalog_versioning on public.services;
create trigger services_catalog_versioning
before insert or update on public.services
for each row execute function private.version_service_catalog();

create or replace function private.snapshot_service_catalog_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.catalog_version is distinct from old.catalog_version then
    insert into public.service_catalog_versions (
      service_id,
      catalog_version,
      catalog_state,
      snapshot,
      changed_by
    ) values (
      new.id,
      new.catalog_version,
      new.catalog_state,
      jsonb_build_object(
        'id', new.id,
        'name', new.name,
        'slug', new.slug,
        'description', new.description,
        'image_url', new.image_url,
        'base_price_cents', new.base_price_cents,
        'pricing_fallback_behavior', new.pricing_fallback_behavior,
        'catalog_state', new.catalog_state,
        'is_active', new.is_active,
        'sort_order', new.sort_order,
        'pricing_version', new.pricing_version
      ),
      new.catalog_updated_by
    ) on conflict (service_id, catalog_version) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists services_catalog_snapshot on public.services;
create trigger services_catalog_snapshot
after insert or update on public.services
for each row execute function private.snapshot_service_catalog_version();

insert into public.service_catalog_versions (
  service_id,
  catalog_version,
  catalog_state,
  snapshot,
  changed_by
)
select
  id,
  catalog_version,
  catalog_state,
  jsonb_build_object(
    'id', id,
    'name', name,
    'slug', slug,
    'description', description,
    'image_url', image_url,
    'base_price_cents', base_price_cents,
    'pricing_fallback_behavior', pricing_fallback_behavior,
    'catalog_state', catalog_state,
    'is_active', is_active,
    'sort_order', sort_order,
    'pricing_version', pricing_version
  ),
  catalog_updated_by
from public.services
on conflict (service_id, catalog_version) do nothing;

comment on column public.services.catalog_state is
  'Fluxo editorial explícito do catálogo: draft, review, published ou inactive.';
comment on table public.service_catalog_versions is
  'Snapshots imutáveis de versões comerciais do serviço, sem dados pessoais.';
