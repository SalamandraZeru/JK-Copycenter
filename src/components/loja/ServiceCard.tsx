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
    base_price: number;
  };
}

function getServiceIcon(slug: string) {
  if (slug.includes('color')) return Sparkles;
  if (slug.includes('encaderna') || slug.includes('livro')) return BookOpen;
  if (slug.includes('banner') || slug.includes('lona')) return Layers;
  if (slug.includes('cartao') || slug.includes('adesivo')) return Stamp;
  if (slug.includes('pb') || slug.includes('impressao')) return Printer;
  return FileText;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const Icon = getServiceIcon(service.slug || service.name.toLowerCase());

  return (
    <div className="group bg-white rounded-xl overflow-hidden border border-slate-200 hover:border-[#1769aa] hover:shadow-lg transition-all duration-200 flex flex-col h-full">
      <div className="aspect-[4/3] bg-[#0d2b5c] overflow-hidden relative flex items-center justify-center p-6">
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
        
        <div className="absolute top-4 right-4 bg-white px-3.5 py-1.5 rounded-full text-xs font-bold text-[#0d2b5c] shadow-sm border border-slate-100">
          A partir de {formatCurrency(service.base_price)}
        </div>
      </div>
      
      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-xl font-bold text-[#13233b] mb-2 font-serif group-hover:text-[#b4232d] transition-colors">
          {service.name}
        </h3>
        <p className="text-slate-600 text-sm mb-6 flex-1 line-clamp-3 leading-relaxed">
          {service.description || 'Configuração personalizada com papéis nobres e acabamentos sob medida.'}
        </p>
        
        <Link 
          href={`/servico/${service.slug}`}
          className="w-full min-h-11 inline-flex items-center justify-center gap-2 bg-[#0d2b5c] hover:bg-[#b4232d] text-white px-5 py-3 rounded-lg font-bold text-sm transition-colors mt-auto"
        >
          Configurar Pedido <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
