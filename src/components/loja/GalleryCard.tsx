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
      className="group relative block aspect-[4/5] scroll-mt-28 overflow-hidden rounded-xl bg-[#092653] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#b4232d]"
    >
      <Image
        src={item.image_url}
        alt={item.title}
        fill
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#061a3b]/90 via-[#061a3b]/20 to-transparent" />

      {item.serviceName && (
        <span className="absolute left-4 top-4 rounded-full bg-[#fffdf8] px-3 py-1 text-xs font-bold text-[#092653]">
          {item.serviceName}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <h3 className="jk-display text-2xl font-black leading-tight text-white sm:text-3xl">{item.title}</h3>
        {item.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/80">{item.description}</p>
        )}
        <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#25d366] px-4 py-2 text-sm font-bold text-[#062b14] transition-transform duration-300 group-hover:-translate-y-0.5">
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          Quero algo parecido
        </span>
      </div>
    </a>
  );
}
