-- Produtos de papelaria podem aparecer em mais de uma categoria.
-- A coluna products.category_id permanece como espelho de compatibilidade para
-- integrações antigas; product_categories passa a ser a fonte canônica.
create table if not exists public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, category_id)
);

create index if not exists product_categories_category_product_idx
  on public.product_categories (category_id, product_id);

-- Preserva as classificações já cadastradas antes da relação múltipla.
insert into public.product_categories (product_id, category_id)
select id, category_id
from public.products
where category_id is not null
on conflict (product_id, category_id) do nothing;

alter table public.product_categories enable row level security;

revoke all on table public.product_categories from public, anon, authenticated;
grant select on table public.product_categories to anon, authenticated;
grant all on table public.product_categories to service_role;

drop policy if exists product_categories_public_read on public.product_categories;
create policy product_categories_public_read
  on public.product_categories for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products product
      where product.id = product_categories.product_id
        and product.is_active = true
        and product.deleted_at is null
    )
    and exists (
      select 1
      from public.categories category
      where category.id = product_categories.category_id
        and category.is_active = true
    )
  );

-- Centraliza a substituição das categorias para impedir vínculos duplicados e
-- para manter o campo legado category_id sincronizado durante a transição.
create or replace function public.replace_product_categories(
  p_product_id uuid,
  p_category_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_category_ids uuid[];
  v_existing_categories integer;
begin
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  select coalesce(array_agg(distinct category_id order by category_id), '{}'::uuid[])
  into v_category_ids
  from unnest(coalesce(p_category_ids, '{}'::uuid[])) as input(category_id);

  select count(*)::integer
  into v_existing_categories
  from public.categories
  where id = any(v_category_ids);

  if v_existing_categories <> cardinality(v_category_ids) then
    raise exception 'INVALID_PRODUCT_CATEGORY';
  end if;

  delete from public.product_categories
  where product_id = p_product_id;

  insert into public.product_categories (product_id, category_id)
  select p_product_id, category_id
  from unnest(v_category_ids) as input(category_id);

  update public.products
  set category_id = v_category_ids[1]
  where id = p_product_id;
end;
$$;

revoke all on function public.replace_product_categories(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.replace_product_categories(uuid, uuid[]) to service_role;

comment on table public.product_categories is
  'Relação canônica N:N entre produtos de papelaria e categorias.';
