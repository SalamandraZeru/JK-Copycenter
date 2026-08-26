-- Faixas de preço de encadernação por serviço. Os valores são mantidos no
-- painel administrativo e nunca são aceitos do navegador como valor confiável.
create extension if not exists btree_gist with schema extensions;

create table public.service_binding_price_tiers (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  min_pages integer not null check (min_pages between 1 and 1000000),
  max_pages integer check (max_pages is null or max_pages between min_pages and 1000000),
  price_cents bigint not null check (price_cents between 0 and 100000000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_binding_price_tiers_no_overlap exclude using gist (
    service_id with =,
    int4range(min_pages, coalesce(max_pages + 1, 1000001), '[)') with &&
  ) where (is_active)
);

create index service_binding_price_tiers_service_pages_idx
  on public.service_binding_price_tiers (service_id, min_pages, max_pages);

alter table public.service_binding_price_tiers enable row level security;
revoke all on table public.service_binding_price_tiers from anon, authenticated;
grant select, insert, update, delete on table public.service_binding_price_tiers to service_role;

comment on table public.service_binding_price_tiers is
  'Faixas administrativas de encadernação. A cotação é calculada no servidor a partir das páginas verificadas de cada arquivo.';
