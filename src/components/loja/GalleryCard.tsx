'use client';

import Image from 'next/image';
import { MessageCircle } from 'lucide-react';

// Número institucional usado em todo o site público (Header, Footer, WhatsApp
// flutuante). Mantido em sincronia com esses componentes.
const WHATSAPP_NUMBER = '5535991066260';

export interface GalleryCardItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  serviceName?: string | null;
}

function buildQuoteUrl(item: GalleryCardItem): string {
  // Usar a URL canônica do site (disponível no servidor e no cliente) evita
  // divergência de hidratação e garante um link estável para o atendente.
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const reference = `${origin}/galeria#trabalho-${item.id}`;
  const lines = [
    'Olá! Vi este trabalho na galeria da JK Copycenter e gostaria de um orçamento de algo parecido:',
    '',
    `• Trabalho: ${item.title}`,
    ...(item.serviceName ? [`• Serviço: ${item.serviceName}`] : []),
    `• Referência: ${reference}`,
  ];
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export function GalleryCard({ item }: { item: GalleryCardItem }) {
  return (
    <a
      id={`trabalho-${item.id}`}
      href={buildQuoteUrl(item)}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex scroll-mt-28 flex-col overflow-hidden rounded-2xl border border-[#092653]/15 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f4f0e8]">
        <Image
          src={item.image_url}
          alt={item.title}
          fill
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
        {item.serviceName && (
          <span className="absolute left-3 top-3 rounded-full bg-[#092653]/90 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white backdrop-blur-sm">
            {item.serviceName}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-black text-[#092653]">{item.title}</h3>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{item.description}</p>
        )}
        <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#b4232d]">
          <MessageCircle className="h-4 w-4" />
          Quero algo parecido
        </span>
      </div>
    </a>
  );
}
