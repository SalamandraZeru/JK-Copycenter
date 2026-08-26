import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { ServiceCard } from '@/components/loja/ServiceCard';

export const revalidate = 60;

export default async function GraficaPage() {
  const supabase = await createClient();

  let services: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
    base_price: number;
  }> = [];

  try {
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

      {services && services.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map(service => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl">
          <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum serviço encontrado</h3>
          <p className="text-slate-500">Consulte a loja para solicitar este serviço.</p>
        </div>
      )}
    </div>
  );
}
