import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { ProductCard } from '@/components/loja/ProductCard';
import Link from 'next/link';

export const revalidate = 60;

export default async function PapelariaPage(
  props: {
    searchParams: Promise<{ categoria?: string; page?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const categoriaSlug = searchParams.categoria;
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
        .eq('is_active', true)
        .maybeSingle();

      if (!selectedCategory) {
        products = [];
        count = 0;
      } else {
      const { data: dbProducts, count: dbCount } = await supabase
        .from('products')
        .select('id, name, slug, description, image_url, price, stock_quantity, product_categories!inner(category_id)', { count: 'exact' })
        .eq('is_active', true)
        .is('deleted_at', null)
        .eq('product_categories.category_id', selectedCategory.id)
        .order('sort_order')
        .range(offset, offset + limit - 1);

      if (dbProducts && dbProducts.length > 0) {
        products = dbProducts;
        count = dbCount || dbProducts.length;
      }
      }
    } else {
      const { data: dbProducts, count: dbCount } = await supabase
        .from('products')
        .select('id, name, slug, description, image_url, price, stock_quantity', { count: 'exact' })
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('sort_order')
        .range(offset, offset + limit - 1);

      if (dbProducts && dbProducts.length > 0) {
        products = dbProducts;
        count = dbCount || dbProducts.length;
      }
    }
  } catch {}

  const totalPages = Math.ceil(count / limit);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Papelaria</h1>
        <p className="text-lg text-slate-600 max-w-3xl">
          Produtos de escritório, materiais escolares e suprimentos essenciais com pronta entrega.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Filters */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sticky top-24 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wider text-slate-500">Categorias</h3>
            <ul className="space-y-1.5">
              <li>
                <Link 
                  href="/papelaria"
                  className={`block px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
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
                    href={`/papelaria?categoria=${cat.slug}`}
                    className={`block px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
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
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                        href={`/papelaria?${categoriaSlug ? `categoria=${categoriaSlug}&` : ''}page=${pageNum}`}
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
