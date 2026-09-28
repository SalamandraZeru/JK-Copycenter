import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Images } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { GalleryCard, type GalleryCardItem } from '@/components/loja/GalleryCard';

export const metadata: Metadata = {
  title: 'Galeria de trabalhos',
  description: 'Exemplos de trabalhos gráficos feitos na JK Copycenter. Viu algo parecido? Peça um orçamento pelo WhatsApp.',
};

export const revalidate = 60;

type GalleryRow = {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  service: { name: string } | { name: string }[] | null;
};

export default async function GaleriaPage() {
  const supabase = await createClient();
  let items: GalleryCardItem[] = [];
  try {
    const { data } = await supabase
      .from('gallery_items')
      .select('id, title, description, image_url, service:services(name)')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    items = ((data as GalleryRow[] | null) || []).map((row) => {
      const service = Array.isArray(row.service) ? row.service[0] : row.service;
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        image_url: row.image_url,
        serviceName: service?.name ?? null,
      };
    });
  } catch {
    items = [];
  }

  return (
    <div className="jk-paper-grid min-h-screen">
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="jk-stagger max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[.2em] text-[#b4232d]">Galeria de trabalhos</p>
          <h1 className="jk-display mt-3 text-5xl font-black text-[#092653] sm:text-6xl">Veja o que já saiu do papel.</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Exemplos reais de produções da JK. Encontrou algo parecido com o que precisa? Toque no trabalho e envie a referência pelo WhatsApp para receber um orçamento.
          </p>
        </div>

        {items.length ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => <GalleryCard key={item.id} item={item} />)}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-[#092653]/15 bg-[#fffdf8] p-10 text-center">
            <Images className="mx-auto h-12 w-12 text-[#092653]/30" />
            <h2 className="mt-4 text-xl font-black text-[#092653]">Galeria em preparação</h2>
            <p className="mt-2 text-slate-600">Em breve traremos exemplos dos nossos trabalhos. Enquanto isso, fale com a equipe.</p>
            <Link href="/grafica" className="mt-5 inline-flex min-h-11 items-center gap-2 font-black text-[#b4232d] underline underline-offset-4">
              Solicitar orçamento <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
