import React from 'react';
import Link from 'next/link';
import { LayoutGrid, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { CategoryBubble, ProductRailCard } from '@/components/loja/CompactCards';

export const revalidate = 60;

export default async function PapelariaPage(
  props: {
    searchParams: Promise<{ categoria?: string; page?: string; q?: string; ordem?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const categoriaSlug = searchParams.categoria;
  const search = (searchParams.q || '').trim().slice(0, 120);
  const sort = ['nome', 'menor_preco', 'maior_preco'].includes(searchParams.ordem || '')
    ? searchParams.ordem!
    : 'nome';
  const page = parseInt(searchParams.page || '1', 10);
  const limit = 24;
  const offset = (page - 1) * limit;

  let categories: Array<{ id: string; name: string; slug: string; image_url?: string | null }> = [];
  let products: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
    price: number;
    stock_quantity: number | null;
  }> = [];
  let count = 0;

  try {
    const { data: dbCategories } = await supabase
      .from('categories')
        .select('id, name, slug, image_url')
        .eq('catalog_scope', 'stationery')
      .eq('is_active', true)
      .order('sort_order');

    if (dbCategories && dbCategories.length > 0) {
      categories = dbCategories;
    }

    // Categorias pertencem exclusivamente à Papelaria. Um produto pode estar
    // em várias categorias, por isso o filtro usa a relação N:N canônica.
    if (categoriaSlug && categoriaSlug !== 'todas') {
      const { data: selectedCategory } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', categoriaSlug)
        .eq('catalog_scope', 'stationery')
        .eq('is_active', true)
        .maybeSingle();

      if (!selectedCategory) {
        products = [];
        count = 0;
      } else {
      let productsQuery = supabase
        .from('products')
        .select('id, name, slug, description, image_url, price, stock_quantity, stock_control_enabled, reserved_quantity, product_categories!inner(category_id)', { count: 'exact' })
        .eq('is_active', true)
        .is('deleted_at', null)
        .eq('product_categories.category_id', selectedCategory.id);
      if (search) productsQuery = productsQuery.ilike('name', `%${search}%`);
      if (sort === 'menor_preco') productsQuery = productsQuery.order('price_cents', { ascending: true }).order('name');
      else if (sort === 'maior_preco') productsQuery = productsQuery.order('price_cents', { ascending: false }).order('name');
      else productsQuery = productsQuery.order('sort_order').order('name');
      const { data: dbProducts, count: dbCount } = await productsQuery.range(offset, offset + limit - 1);

      if (dbProducts && dbProducts.length > 0) {
        products = dbProducts.map((product) => ({
          ...product,
          stock_quantity: product.stock_control_enabled && product.stock_quantity !== null
            ? Math.max(0, product.stock_quantity - product.reserved_quantity)
            : null,
        }));
        count = dbCount || dbProducts.length;
      }
      }
    } else {
      let productsQuery = supabase
        .from('products')
        .select('id, name, slug, description, image_url, price, stock_quantity, stock_control_enabled, reserved_quantity', { count: 'exact' })
        .eq('is_active', true)
        .is('deleted_at', null);
      if (search) productsQuery = productsQuery.ilike('name', `%${search}%`);
      if (sort === 'menor_preco') productsQuery = productsQuery.order('price_cents', { ascending: true }).order('name');
      else if (sort === 'maior_preco') productsQuery = productsQuery.order('price_cents', { ascending: false }).order('name');
      else productsQuery = productsQuery.order('sort_order').order('name');
      const { data: dbProducts, count: dbCount } = await productsQuery.range(offset, offset + limit - 1);

      if (dbProducts && dbProducts.length > 0) {
        products = dbProducts.map((product) => ({
          ...product,
          stock_quantity: product.stock_control_enabled && product.stock_quantity !== null
            ? Math.max(0, product.stock_quantity - product.reserved_quantity)
            : null,
        }));
        count = dbCount || dbProducts.length;
      }
    }
  } catch {}

  const totalPages = Math.ceil(count / limit);
  const activeCategory = categoriaSlug && categoriaSlug !== 'todas' ? categoriaSlug : null;
  const activeCategoryName = categories.find((category) => category.slug === activeCategory)?.name;
  const queryFor = (overrides: { categoria?: string | null; page?: number }) => {
    const params = new URLSearchParams();
    const categoria = overrides.categoria === undefined ? activeCategory : overrides.categoria;
    if (categoria) params.set('categoria', categoria);
    if (search) params.set('q', search);
    if (sort !== 'nome') params.set('ordem', sort);
    if (overrides.page && overrides.page > 1) params.set('page', String(overrides.page));
    const query = params.toString();
    return query ? `/papelaria?${query}` : '/papelaria';
  };

  return (
    <div className="jk-paper-grid min-h-screen w-full min-w-0">
      {/* Topo curto com busca: produtos aparecem já na primeira tela do celular */}
      <section className="border-b border-[#092653]/10 bg-[#fffdf8]">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
          <p className="text-[11px] font-black uppercase tracking-[.16em] text-[#b4232d]">Papelaria · preço na hora</p>
          <h1 className="jk-display mt-1 text-[1.9rem] font-black leading-tight text-[#092653] sm:text-5xl">Papelaria para a rotina.</h1>
          <form action="/papelaria" className="mt-4 flex gap-2" role="search">
            {activeCategory && <input type="hidden" name="categoria" value={activeCategory} />}
            {sort !== 'nome' && <input type="hidden" name="ordem" value={sort} />}
            <label className="sr-only" htmlFor="catalog-search">Buscar produto</label>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="catalog-search"
                name="q"
                type="search"
                defaultValue={search}
                maxLength={120}
                placeholder="Buscar caderno, caneta, papel…"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm font-medium text-slate-900 outline-none transition focus:border-[#092653] focus:ring-2 focus:ring-[#092653]/20"
              />
            </div>
            <button type="submit" className="h-11 rounded-xl bg-[#092653] px-4 text-sm font-bold text-white transition hover:bg-[#b4232d]">Buscar</button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        {categories.length > 0 && (
          <nav aria-label="Categorias" className="jk-rail -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:gap-5 sm:px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            <Link
              href={queryFor({ categoria: null })}
              aria-current={!activeCategory ? 'page' : undefined}
              className="group flex w-[4.75rem] flex-none snap-start flex-col items-center gap-2 text-center sm:w-24"
            >
              <span className={`flex h-16 w-16 items-center justify-center rounded-full bg-[#092653] text-white transition sm:h-20 sm:w-20 ${!activeCategory ? 'ring-[3px] ring-[#b4232d] ring-offset-2' : 'ring-2 ring-[#092653]/10 group-hover:ring-[#b4232d]'}`}>
                <LayoutGrid className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className={`text-xs font-bold leading-tight sm:text-sm ${!activeCategory ? 'text-[#b4232d]' : 'text-[#13233b]'}`}>Todos</span>
            </Link>
            {categories.map((category) => (
              <CategoryBubble
                key={category.id}
                category={{ ...category, image_url: category.image_url ?? null }}
                href={queryFor({ categoria: category.slug })}
                active={activeCategory === category.slug}
              />
            ))}
          </nav>
        )}

        <div className="mb-3 mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-600">
            {count} {count === 1 ? 'produto' : 'produtos'}
            {activeCategoryName && <> em <strong className="text-[#092653]">{activeCategoryName}</strong></>}
            {search && <> para “<strong className="text-[#092653]">{search}</strong>”</>}
          </p>
          <form action="/papelaria" className="flex items-center gap-2">
            {activeCategory && <input type="hidden" name="categoria" value={activeCategory} />}
            {search && <input type="hidden" name="q" value={search} />}
            <label className="sr-only" htmlFor="catalog-sort">Ordenar produtos</label>
            <select id="catalog-sort" name="ordem" defaultValue={sort} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-800 outline-none focus:border-[#092653]">
              <option value="nome">Ordem do catálogo</option>
              <option value="menor_preco">Menor preço</option>
              <option value="maior_preco">Maior preço</option>
            </select>
            <button type="submit" className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-[#092653] hover:bg-slate-50">Ordenar</button>
          </form>
        </div>

        {products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-4">
              {products.map((product) => <ProductRailCard key={product.id} product={product} fluid />)}
            </div>

            {totalPages > 1 && (
              <nav aria-label="Páginas" className="mt-8 flex flex-wrap justify-center gap-2">
                {Array.from({ length: totalPages }).map((_, index) => {
                  const pageNumber = index + 1;
                  const isActive = pageNumber === page;
                  return (
                    <Link
                      key={pageNumber}
                      href={queryFor({ page: pageNumber })}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-colors ${
                        isActive ? 'bg-[#092653] text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {pageNumber}
                    </Link>
                  );
                })}
              </nav>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-[#092653]/15 bg-[#fffdf8] px-6 py-12 text-center">
            <h3 className="text-lg font-black text-[#092653]">Nenhum produto encontrado</h3>
            <p className="mt-1 text-sm text-slate-600">Tente outra categoria ou outra palavra na busca.</p>
            <Link href="/papelaria" className="mt-4 inline-flex font-bold text-[#b4232d] underline underline-offset-4">Ver todos os produtos</Link>
          </div>
        )}
      </div>
    </div>
  );
}
