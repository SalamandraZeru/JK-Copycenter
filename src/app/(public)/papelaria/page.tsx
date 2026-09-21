import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { ProductCard } from '@/components/loja/ProductCard';
import Link from 'next/link';

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

  return (
    <div className="jk-paper-grid mx-auto min-h-screen w-full min-w-0 max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mb-10">
        <p className="mb-3 text-xs font-black uppercase tracking-[.2em] text-[#b4232d]">Catálogo com preço e estoque</p>
        <h1 className="jk-display mb-4 text-5xl font-black text-[#092653] sm:text-6xl">Papelaria para a rotina.</h1>
        <p className="text-lg text-slate-600 max-w-3xl">
          Consulte os itens publicados, compare preços e adicione ao carrinho. A disponibilidade exibida vem do estoque cadastrado.
        </p>
        <form action="/papelaria" className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_190px_auto]">
          {categoriaSlug && categoriaSlug !== 'todas' && <input type="hidden" name="categoria" value={categoriaSlug} />}
          <label className="sr-only" htmlFor="catalog-search">Buscar produto</label>
          <input
            id="catalog-search"
            name="q"
            defaultValue={search}
            maxLength={120}
            placeholder="Buscar produto de papelaria"
            className="min-w-0 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
          />
          <label className="sr-only" htmlFor="catalog-sort">Ordenar produtos</label>
          <select id="catalog-sort" name="ordem" defaultValue={sort} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20">
            <option value="nome">Ordenar: catálogo</option>
            <option value="menor_preco">Menor preço</option>
            <option value="maior_preco">Maior preço</option>
          </select>
          <button type="submit" className="rounded-xl bg-[#0F2040] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700">Buscar</button>
        </form>
      </div>

      <div className="flex flex-col gap-8">
        {/* Sidebar Filters */}
        <div className="w-full">
          <div className="rounded-2xl border border-slate-200 bg-[#fffdf8] p-4 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider text-slate-500">Categorias</h3>
            <ul className="flex gap-2 overflow-x-auto pb-1">
              <li>
                <Link 
                  href="/papelaria"
                  className={`block whitespace-nowrap px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    !categoriaSlug || categoriaSlug === 'todas'
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Todos os Produtos
                </Link>
              </li>
              {categories.map(cat => (
                <li key={cat.id}>
                  <Link 
                    href={`/papelaria?categoria=${cat.slug}${search ? `&q=${encodeURIComponent(search)}` : ''}${sort !== 'nome' ? `&ordem=${sort}` : ''}`}
                    className={`block whitespace-nowrap px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      categoriaSlug === cat.slug
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 flex flex-col">
          {products && products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
                {products.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-12 flex justify-center gap-2">
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pageNum = i + 1;
                    const isActive = pageNum === page;
                    return (
                      <Link
                        key={pageNum}
                        href={`/papelaria?${categoriaSlug ? `categoria=${categoriaSlug}&` : ''}${search ? `q=${encodeURIComponent(search)}&` : ''}${sort !== 'nome' ? `ordem=${sort}&` : ''}page=${pageNum}`}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl font-medium transition-colors ${
                          isActive 
                            ? 'bg-blue-600 text-white shadow-sm' 
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl">
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum produto encontrado</h3>
              <p className="text-slate-500">Tente selecionar outra categoria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
