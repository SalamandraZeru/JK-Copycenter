-- Galeria de trabalhos: exemplos reais de produções, exibidos publicamente e
-- opcionalmente vinculados a um serviço. Ao clicar, o cliente é levado ao
-- WhatsApp para solicitar um orçamento semelhante. Não há preço envolvido.
create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text not null,
  service_id uuid references public.services(id) on delete set null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.gallery_items is
  'Exemplos de trabalhos exibidos na galeria pública; opcionalmente vinculados a um serviço. Sem preço.';

create index if not exists idx_gallery_items_active
  on public.gallery_items (is_active, sort_order, created_at desc);

create index if not exists idx_gallery_items_service
  on public.gallery_items (service_id)
  where service_id is not null;

alter table public.gallery_items enable row level security;

-- Leitura pública apenas de itens ativos; escrita é exclusiva da service role
-- (rota administrativa server-side), portanto não há política de escrita.
drop policy if exists gallery_items_public_read on public.gallery_items;
create policy gallery_items_public_read
  on public.gallery_items for select
  to anon, authenticated
  using (is_active = true);

grant select on public.gallery_items to anon, authenticated;
grant all on public.gallery_items to service_role;
