import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';
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

// Cartão editorial de serviço: foto sangrada no topo, título em serifa e uma
// única chamada de ação. O cartão inteiro é clicável (link "esticado").
export function ServiceCard({ service, manualQuote = false }: ServiceCardProps) {
  const isQuote = manualQuote || service.base_price === undefined;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl bg-[#fffdf8] text-slate-900">
      <div className="relative aspect-[3/2] overflow-hidden bg-[#061a3b]">
        {service.image_url ? (
          <Image
            src={service.image_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="jk-paper-grid absolute inset-0 opacity-10" />
        )}
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#fffdf8] px-3 py-1.5 text-xs font-bold text-[#092653]">
          {isQuote ? (
            <>
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Orçamento sob medida
            </>
          ) : (
            `A partir de ${formatCurrency(service.base_price ?? 0)}`
          )}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <h3 className="jk-display text-3xl font-black leading-tight text-[#092653]">
          <Link
            href={`/servico/${service.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-[#b4232d]"
          >
            {service.name}
          </Link>
        </h3>
        <p className="mt-3 line-clamp-3 flex-1 text-[15px] leading-relaxed text-slate-600">
          {service.description || 'Conte o que precisa, envie os arquivos e a equipe responde com o orçamento.'}
        </p>
        <span className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[#b4232d]">
          {isQuote ? 'Solicitar orçamento' : 'Configurar pedido'}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}
