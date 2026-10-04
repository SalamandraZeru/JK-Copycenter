import Link from 'next/link';
import { ArrowRight, FileCheck2, FileUp, MessageCircle, MessageSquareText, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ServiceRailCard } from '@/components/loja/CompactCards';
import { WHATSAPP_URL } from '@/lib/site/contact';

export const revalidate = 60;

const STEPS = [
  { icon: FileUp, label: 'Escolha e envie o arquivo' },
  { icon: FileCheck2, label: 'A equipe confere' },
  { icon: MessageSquareText, label: 'Você recebe o orçamento' },
];

export default async function GraficaPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('services')
    .select('id, name, slug, image_url')
    .eq('is_active', true)
    .eq('catalog_state', 'published')
    .is('deleted_at', null)
    .order('sort_order');
  const services = data || [];

  return (
    <div className="jk-paper-grid min-h-screen">
      {/* Topo curto: o catálogo aparece já na primeira tela do celular */}
      <section className="border-b border-[#092653]/10 bg-[#092653] text-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
          <p className="text-[11px] font-black uppercase tracking-[.16em] text-[#9ed0ff]">Gráfica · orçamento sem compromisso</p>
          <h1 className="jk-display mt-2 text-[1.9rem] font-black leading-[1.05] sm:text-5xl">Primeiro o arquivo, depois o preço.</h1>
          <ol className="mt-4 flex flex-wrap gap-2 sm:mt-6">
            {STEPS.map(({ icon: Icon, label }, index) => (
              <li key={label} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold sm:text-sm">
                <span className="text-[#9ed0ff]">{index + 1}</span>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="catalogo" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="jk-display text-2xl font-black text-[#092653] sm:text-3xl">O que vamos produzir?</h2>
          <span className="text-sm font-semibold text-slate-500">{services.length} serviços</span>
        </div>
        {services.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
            {services.map((service) => <ServiceRailCard key={service.id} service={service} fluid />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#092653]/15 bg-[#fffdf8] p-6 text-center">
            <h3 className="text-lg font-black text-[#092653]">Catálogo temporariamente indisponível</h3>
            <p className="mt-1 text-sm text-slate-600">Fale com a equipe e explique o que precisa.</p>
          </div>
        )}

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center gap-4 rounded-2xl border border-[#092653]/15 bg-[#fffdf8] p-4 transition hover:border-[#092653]/40"
        >
          <MessageCircle className="h-7 w-7 flex-none text-[#1f9d55]" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-black text-[#092653]">Não achou o que precisa?</span>
            <span className="block text-xs text-slate-600 sm:text-sm">Chame no WhatsApp: fazemos muitos outros trabalhos sob medida.</span>
          </span>
          <ArrowRight className="h-5 w-5 flex-none text-[#092653]" aria-hidden="true" />
        </a>
      </section>

      <section className="border-t border-[#092653]/10 bg-[#fffdf8]">
        <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-6 sm:px-6 lg:px-8">
          <ShieldCheck className="mt-0.5 h-6 w-6 flex-none text-[#092653]" aria-hidden="true" />
          <p className="text-sm leading-6 text-slate-600">
            <strong className="text-[#092653]">Arquivos privados e temporários.</strong> O arquivo não vai pelo WhatsApp: fica protegido para análise e produção e é apagado depois.{' '}
            <Link href="/privacidade" className="font-bold text-[#092653] underline underline-offset-4">Como protegemos</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
