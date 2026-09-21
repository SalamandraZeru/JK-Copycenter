/* eslint-disable @next/next/no-img-element */
import React from 'react';
import Link from 'next/link';
import { ArrowRight, Printer, FileText, Sparkles, Layers, BookOpen, Stamp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';

interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
    base_price?: number;
  };
  manualQuote?: boolean;
}

function getServiceIcon(slug: string) {
  if (slug.includes('color')) return Sparkles;
  if (slug.includes('encaderna') || slug.includes('livro')) return BookOpen;
  if (slug.includes('banner') || slug.includes('lona')) return Layers;
  if (slug.includes('cartao') || slug.includes('adesivo')) return Stamp;
  if (slug.includes('pb') || slug.includes('impressao')) return Printer;
  return FileText;
}

export function ServiceCard({ service, manualQuote = false }: ServiceCardProps) {
  const Icon = getServiceIcon(service.slug || service.name.toLowerCase());

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#fffdf8] text-slate-900 transition duration-300 hover:-translate-y-1 hover:border-white/35">
      <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-[#061a3b] p-6">
        {service.image_url ? (
          <img 
            src={service.image_url} 
            alt={service.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center text-white relative z-10">
            <div className="w-16 h-16 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-200">
              <Icon className="w-8 h-8 text-[#9ed0ff]" />
            </div>
            <span className="text-xs uppercase tracking-widest text-slate-300 font-semibold">
              Serviço Gráfico
            </span>
          </div>
        )}
        
        <div className="absolute right-4 top-4 rounded-full border border-white/50 bg-white/95 px-3.5 py-1.5 text-xs font-bold text-[#0d2b5c]">
          {manualQuote || service.base_price === undefined
            ? 'Análise pela equipe'
            : `A partir de ${formatCurrency(service.base_price)}`}
        </div>
      </div>
      
      <div className="flex flex-1 flex-col p-6">
        <h3 className="jk-display mb-2 text-2xl font-black text-[#092653] transition-colors group-hover:text-[#b4232d]">
          {service.name}
        </h3>
        <p className="text-slate-600 text-sm mb-6 flex-1 line-clamp-3 leading-relaxed">
          {service.description || 'Informe os detalhes e envie os arquivos para análise da equipe.'}
        </p>
        
        <Link 
          href={`/servico/${service.slug}`}
          className="mt-auto inline-flex min-h-11 w-full items-center justify-between gap-2 border-t border-slate-200 pt-4 text-sm font-black text-[#092653] transition-colors hover:text-[#b4232d]"
        >
          {manualQuote ? 'Solicitar orçamento' : 'Configurar pedido'} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}
