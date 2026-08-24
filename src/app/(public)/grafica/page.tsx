import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { ServiceCard } from '@/components/loja/ServiceCard';
import Link from 'next/link';

export const revalidate = 60;

export default async function GraficaPage(
  props: {
    searchParams: Promise<{ categoria?: string }>
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const categoriaSlug = searchParams.categoria;

  let categories: Array<{ id: string; name: string; slug: string; image_url?: string | null }> = [];
  let services: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
    base_price: number;
  }> = [];

  try {
    const { data: dbCategories } = await supabase
      .from('categories')
      .select('id, name, slug, image_url')
      .eq('is_active', true)
      .order('sort_order');

    if (dbCategories && dbCategories.length > 0) {
      categories = dbCategories;
    }

    let query = supabase
      .from('services')
      .select('id, name, slug, description, image_url, base_price')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order');

    const { data: dbServices } = await query;
    if (dbServices && dbServices.length > 0) {
      services = dbServices;
    }
  } catch {}

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Serviços Gráficos</h1>
        <p className="text-lg text-slate-600 max-w-3xl">
          Escolha o serviço desejado, envie seus arquivos e configure os detalhes da impressão com cálculo em tempo real.
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
                  href="/grafica"
                  className={`block px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    !categoriaSlug || categoriaSlug === 'todas'
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Todos os Serviços
                </Link>
              </li>
              {categories.map(cat => (
                <li key={cat.id}>
                  <Link 
                    href={`/grafica?categoria=${cat.slug}`}
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

        {/* Services Grid */}
        <div className="flex-1">
          {services && services.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map(service => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl">
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum serviço encontrado</h3>
              <p className="text-slate-500">Tente selecionar outra categoria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
