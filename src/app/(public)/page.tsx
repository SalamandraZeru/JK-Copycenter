import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, FileUp, MapPin, MessageCircle, PackageOpen, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ServiceCard } from '@/components/loja/ServiceCard';
import { CategoryCard } from '@/components/loja/CategoryCard';
import { GalleryCard, type GalleryCardItem } from '@/components/loja/GalleryCard';

export const revalidate = 60;

type HomeGalleryRow = {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  service: { name: string } | { name: string }[] | null;
};

export default async function HomePage() {
  const supabase = await createClient();
  const [serviceResult, categoryResult, galleryResult] = await Promise.all([
    supabase.from('services').select('id, name, slug, description, image_url').eq('is_active', true).eq('catalog_state', 'published').is('deleted_at', null).order('sort_order').limit(6),
    supabase.from('categories').select('id, name, slug, image_url').eq('catalog_scope', 'stationery').eq('is_active', true).order('sort_order').limit(6),
    supabase.from('gallery_items').select('id, title, description, image_url, service:services(name)').eq('is_active', true).order('sort_order').order('created_at', { ascending: false }).limit(6),
  ]);
  const services = serviceResult.data || [];
  const categories = categoryResult.data || [];
  const galleryItems: GalleryCardItem[] = ((galleryResult.data as HomeGalleryRow[] | null) || []).map((row) => {
    const service = Array.isArray(row.service) ? row.service[0] : row.service;
    return { id: row.id, title: row.title, description: row.description, image_url: row.image_url, serviceName: service?.name ?? null };
  });

  return <div className="jk-paper-grid overflow-hidden">
    <section className="relative border-b border-[#092653]/15 bg-[#fffdf8]">
      <div className="mx-auto grid max-w-7xl items-stretch lg:grid-cols-[1.08fr_.92fr]">
        <div className="jk-stagger flex flex-col justify-center px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#092653]/15 bg-[#f4f0e8] px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-[#092653]"><MapPin className="h-3.5 w-3.5" />Feito em Passos, com atendimento humano</div>
          <h1 className="jk-display mt-6 max-w-3xl text-5xl font-black leading-[.98] text-[#092653] sm:text-6xl lg:text-7xl">Seu arquivo merece chegar certo ao papel.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">Conte o que precisa, envie o material com segurança e receba uma análise da equipe antes de qualquer cobrança.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/grafica" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#b4232d] px-7 py-3.5 font-black text-white shadow-[0_8px_24px_rgba(180,35,45,.2)] transition hover:-translate-y-0.5 hover:bg-[#951c25]">Solicitar orçamento <ArrowRight className="h-4 w-4" /></Link><Link href="/papelaria" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#092653]/25 bg-white px-7 py-3.5 font-black text-[#092653] transition hover:border-[#092653]">Comprar papelaria</Link></div>
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-slate-200 pt-6 text-sm font-bold text-slate-700 sm:max-w-xl"><span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#b4232d]" />Sem preço automático</span><span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#b4232d]" />Arquivo privado</span><span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#b4232d]" />Proposta registrada</span><span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#b4232d]" />Retirada em Passos</span></div>
        </div>
        <div className="relative min-h-[380px] overflow-hidden border-l border-[#092653]/10 lg:min-h-[650px]"><Image src="/images/hero/jk-hero-papeis-1440.webp" alt="Prateleiras com papéis e materiais gráficos coloridos na JK Copycenter" fill sizes="(min-width: 1024px) 46vw, 100vw" className="jk-kenburns object-cover object-center" priority /><div className="absolute inset-0 bg-gradient-to-t from-[#092653]/75 via-transparent to-transparent" /><div className="jk-float absolute inset-x-5 bottom-5 rounded-2xl border border-white/25 bg-[#092653]/90 p-5 text-white backdrop-blur-sm sm:inset-x-8 sm:bottom-8"><p className="text-xs font-black uppercase tracking-[0.16em] text-blue-200">Papéis, acabamentos e materiais</p><p className="mt-1 text-lg font-bold">Loja em Passos · Av. JK, 270</p><a href="https://share.google/3jStxc1OYvpfH5rJ2" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold underline underline-offset-4">Abrir rota <ArrowRight className="h-4 w-4" /></a></div></div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mb-10 max-w-2xl"><p className="text-xs font-black uppercase tracking-[.2em] text-[#b4232d]">Do pedido à proposta</p><h2 className="jk-display mt-3 text-4xl font-black text-[#092653] sm:text-5xl">Três passos, sem adivinhação.</h2><p className="mt-4 text-slate-600">A equipe confere o material antes de transformar a solicitação em valor.</p></div>
      <ol className="grid gap-px overflow-hidden rounded-3xl border border-[#092653]/15 bg-[#092653]/15 lg:grid-cols-3">{[[FileUp, '01', 'Escolha e envie', 'Selecione o serviço, informe as opções disponíveis e anexe os arquivos.'], [ShieldCheck, '02', 'Análise da equipe', 'A JK verifica o escopo e prepara uma proposta adequada ao material.'], [MessageCircle, '03', 'Decida com clareza', 'Você recebe o valor registrado, aceita ou recusa e combina o próximo passo.']].map(([Icon, number, title, text]) => { const StepIcon = Icon as typeof FileUp; return <li key={String(number)} className="bg-[#fffdf8] p-6 sm:p-8"><div className="flex items-center justify-between"><StepIcon className="h-7 w-7 text-[#b4232d]" /><span className="jk-display text-3xl font-black text-[#092653]/25">{String(number)}</span></div><h3 className="mt-8 text-xl font-black text-[#092653]">{String(title)}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{String(text)}</p></li>; })}</ol>
    </section>

    <section className="border-y border-[#092653]/10 bg-[#092653] py-16 text-white sm:py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-blue-200">Serviços gráficos</p><h2 className="jk-display mt-3 text-4xl font-black sm:text-5xl">Comece pelo que você precisa.</h2></div><Link href="/grafica" className="inline-flex min-h-11 items-center gap-2 font-bold text-white underline decoration-blue-300 underline-offset-4">Ver catálogo completo <ArrowRight className="h-4 w-4" /></Link></div>{services.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{services.map((service) => <ServiceCard key={service.id} service={service} manualQuote />)}</div> : <div className="rounded-2xl border border-white/20 bg-white/5 p-8 text-slate-200">O catálogo está temporariamente indisponível. Fale com a equipe para solicitar um serviço.</div>}</div></section>

    {galleryItems.length > 0 && <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8"><div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div className="max-w-2xl"><p className="text-xs font-black uppercase tracking-[.2em] text-[#b4232d]">Galeria de trabalhos</p><h2 className="jk-display mt-3 text-4xl font-black text-[#092653] sm:text-5xl">Prova no papel, não só na promessa.</h2><p className="mt-4 text-slate-600">Viu algo parecido com o que precisa? Toque no trabalho e envie a referência pelo WhatsApp.</p></div><Link href="/galeria" className="inline-flex min-h-11 items-center gap-2 font-bold text-[#092653] underline decoration-[#b4232d] underline-offset-4">Ver a galeria <ArrowRight className="h-4 w-4" /></Link></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{galleryItems.map((item) => <GalleryCard key={item.id} item={item} />)}</div></section>}

    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8"><div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#b4232d]">Papelaria</p><h2 className="jk-display mt-3 text-4xl font-black text-[#092653] sm:text-5xl">Produtos para a rotina, sem misturar com o orçamento gráfico.</h2><p className="mt-4 leading-7 text-slate-600">Na papelaria, preço e estoque continuam visíveis e a compra segue pelo carrinho.</p><Link href="/papelaria" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#092653] px-6 font-black text-white">Explorar produtos <PackageOpen className="h-5 w-5" /></Link></div>{categories.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{categories.map((category) => <CategoryCard key={category.id} category={category} />)}</div> : <div className="rounded-2xl border border-[#092653]/15 bg-[#fffdf8] p-8 text-slate-600">Categorias serão exibidas quando estiverem publicadas.</div>}</div></section>
  </div>;
}
