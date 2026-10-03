import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, Lock, MapPin, MessageCircle, PencilLine, Printer, ReceiptText } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { CategoryBubble, ProductRailCard, ServiceRailCard } from '@/components/loja/CompactCards';
import { GalleryCard, type GalleryCardItem } from '@/components/loja/GalleryCard';
import { OPENING_HOURS_SHORT, WHATSAPP_URL } from '@/lib/site/contact';

export const revalidate = 60;

type HomeGalleryRow = {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  service: { name: string } | { name: string }[] | null;
};

// Trilho: rola para o lado no celular e vira grade a partir do tablet.
const RAIL = 'jk-rail -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 md:mx-0 md:grid md:overflow-visible md:px-0 md:pb-0';

function SectionHead({ eyebrow, title, href, linkLabel }: { eyebrow?: string; title: ReactNode; href: string; linkLabel: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 sm:mb-6">
      <div>
        {eyebrow && <p className="text-[11px] font-black uppercase tracking-[.16em] text-[#b4232d]">{eyebrow}</p>}
        <h2 className="jk-display text-2xl font-black leading-tight text-[#092653] sm:text-3xl">{title}</h2>
      </div>
      <Link href={href} className="inline-flex min-h-10 flex-none items-center gap-1 text-sm font-bold text-[#b4232d] hover:underline">
        {linkLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

export default async function HomePage() {
  const supabase = await createClient();
  const [serviceResult, categoryResult, productResult, galleryResult] = await Promise.all([
    supabase.from('services').select('id, name, slug, image_url').eq('is_active', true).eq('catalog_state', 'published').is('deleted_at', null).order('sort_order').limit(8),
    supabase.from('categories').select('id, name, slug, image_url').eq('catalog_scope', 'stationery').eq('is_active', true).order('sort_order').limit(12),
    supabase.from('products').select('id, name, slug, image_url, price, stock_quantity').eq('is_active', true).is('deleted_at', null).order('sort_order').limit(10),
    supabase.from('gallery_items').select('id, title, description, image_url, service:services(name)').eq('is_active', true).order('sort_order').order('created_at', { ascending: false }).limit(6),
  ]);
  const services = serviceResult.data || [];
  const categories = categoryResult.data || [];
  const products = productResult.data || [];
  const galleryItems: GalleryCardItem[] = ((galleryResult.data as HomeGalleryRow[] | null) || []).map((row) => {
    const service = Array.isArray(row.service) ? row.service[0] : row.service;
    return { id: row.id, title: row.title, description: row.description, image_url: row.image_url, serviceName: service?.name ?? null };
  });

  return (
    <div className="jk-paper-grid">
      {/* Topo: frase curta e as duas frentes do negócio lado a lado */}
      <section className="border-b border-[#092653]/10 bg-[#fffdf8]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-7 sm:px-6 sm:py-12 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-14">
          <div>
            <h1 className="jk-display text-[2rem] font-black leading-[1.05] text-[#092653] sm:text-5xl lg:text-6xl">
              Seu arquivo chega certo ao papel.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600 sm:text-lg sm:leading-8">
              Orçamento da equipe antes de qualquer cobrança. Papelaria com preço na hora.
            </p>
            <div className="mt-6 grid max-w-lg grid-cols-2 gap-3">
              <Link href="/grafica" className="group rounded-2xl bg-[#092653] p-4 text-white transition hover:-translate-y-0.5 sm:p-5">
                <Printer className="h-6 w-6 text-[#9ed0ff]" aria-hidden="true" />
                <span className="mt-3 block text-base font-black sm:text-lg">Gráfica</span>
                <span className="mt-0.5 block text-xs text-blue-100/80 sm:text-sm">Orçamento pelo WhatsApp</span>
              </Link>
              <Link href="/papelaria" className="group rounded-2xl border border-[#092653]/15 bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#092653]/40 sm:p-5">
                <PencilLine className="h-6 w-6 text-[#b4232d]" aria-hidden="true" />
                <span className="mt-3 block text-base font-black text-[#092653] sm:text-lg">Papelaria</span>
                <span className="mt-0.5 block text-xs text-slate-600 sm:text-sm">Preço na hora</span>
              </Link>
            </div>
          </div>
          <div className="relative hidden aspect-[5/4] overflow-hidden rounded-3xl lg:block">
            <Image
              src="/images/hero/jk-hero-papeis-1440.webp"
              alt="Prateleiras com papéis e materiais gráficos coloridos na JK Copycenter"
              fill
              sizes="45vw"
              className="object-cover"
              priority
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-9 px-4 py-8 sm:space-y-14 sm:px-6 sm:py-12 lg:px-8">
        {categories.length > 0 && (
          <section>
            <SectionHead title="Categorias" href="/papelaria" linkLabel="Ver todas" />
            <div className="jk-rail -mx-4 flex snap-x gap-3 overflow-x-auto px-4 sm:-mx-6 sm:gap-5 sm:px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              {categories.map((category) => (
                <CategoryBubble key={category.id} category={category} />
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionHead eyebrow="Gráfica" title="Serviços" href="/grafica" linkLabel="Ver todos" />
          {services.length > 0 ? (
            <div className={`${RAIL} md:grid-cols-3 lg:grid-cols-4`}>
              {services.map((service) => (
                <ServiceRailCard key={service.id} service={service} />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-[#092653]/15 bg-[#fffdf8] p-5 text-sm text-slate-600">
              O catálogo está temporariamente indisponível. Fale com a equipe pelo WhatsApp.
            </p>
          )}
        </section>

        {products.length > 0 && (
          <section>
            <SectionHead eyebrow="Papelaria" title="Da papelaria" href="/papelaria" linkLabel="Ver todos" />
            <div className={`${RAIL} md:grid-cols-4 lg:grid-cols-5`}>
              {products.map((product) => (
                <ProductRailCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {galleryItems.length > 0 && (
          <section>
            <SectionHead eyebrow="Galeria" title="Trabalhos feitos aqui" href="/galeria" linkLabel="Ver galeria" />
            <div className={`${RAIL} md:grid-cols-3`}>
              {galleryItems.map((item) => (
                <div key={item.id} className="w-60 flex-none snap-start md:w-auto">
                  <GalleryCard item={item} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-5">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl bg-[#092653] p-4 text-white transition hover:bg-[#0d2b5c] sm:p-6"
          >
            <MessageCircle className="h-8 w-8 flex-none text-[#5DCAA5]" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-black sm:text-lg">Dúvida? Fale com a equipe</span>
              <span className="block text-xs text-blue-100/80 sm:text-sm">{OPENING_HOURS_SHORT}</span>
            </span>
            <ArrowRight className="h-5 w-5 flex-none" aria-hidden="true" />
          </a>
          <ul className="grid grid-cols-3 gap-2 text-center text-[11px] font-bold leading-tight text-slate-600 sm:text-sm">
            <li className="flex flex-col items-center gap-1.5"><Lock className="h-5 w-5 text-[#b4232d]" aria-hidden="true" />Arquivo privado</li>
            <li className="flex flex-col items-center gap-1.5"><ReceiptText className="h-5 w-5 text-[#b4232d]" aria-hidden="true" />Sem preço surpresa</li>
            <li className="flex flex-col items-center gap-1.5"><MapPin className="h-5 w-5 text-[#b4232d]" aria-hidden="true" />Retira na loja</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
