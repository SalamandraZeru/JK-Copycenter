import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { ServiceCard } from '@/components/loja/ServiceCard';
import { CategoryCard } from '@/components/loja/CategoryCard';
import { Printer, Clock, ShieldCheck, ArrowRight, FileText, PhoneCall, CheckCircle2 } from 'lucide-react';
import { DEFAULT_SERVICES, DEFAULT_CATEGORIES } from '@/lib/catalog/default-services';

export const revalidate = 60; // 1 minute cache

export default async function HomePage() {
  const supabase = await createClient();

  // Fetch active categories with safe fallback
  let activeCategories: Array<{ id: string; name: string; slug: string; image_url: string | null }> = DEFAULT_CATEGORIES;
  try {
    const { data: dbCategories } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (dbCategories && dbCategories.length > 0) {
      activeCategories = dbCategories;
    }
  } catch {
    // fallback
  }

  // Fetch active services with safe fallback
  let activeServices: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
    base_price: number;
  }> = DEFAULT_SERVICES;
  try {
    const { data: dbServices } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order')
      .limit(6);
    if (dbServices && dbServices.length > 0) {
      activeServices = dbServices;
    }
  } catch {
    // fallback
  }

  const whatsappNumber = '5535991066260';

  return (
    <div className="flex flex-col bg-[#f8fafc]">
      <section className="relative bg-[#081d40] text-white overflow-hidden py-14 sm:py-20">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Headlines & Action CTAs */}
            <div className="lg:col-span-7 text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6 font-serif">
                Sua gráfica rápida,<br className="hidden sm:inline" />
                <span className="text-[#9ed0ff]"> pertinho de você.</span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-200 mb-8 max-w-2xl leading-relaxed">
                Tudo o que você precisa em serviços gráficos e materiais de papelaria, impresso com perfeição e entregue no prazo.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-10">
                <Link
                  href="/grafica" 
                  className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#b4232d] hover:bg-[#951c25] text-white font-bold py-3 px-7 rounded-lg shadow-md transition-colors"
                >
                  <FileText className="w-5 h-5" />
                  Fazer Pedido Agora
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/papelaria" 
                  className="inline-flex min-h-12 items-center justify-center gap-2 bg-white text-[#0d2b5c] hover:bg-slate-100 font-bold py-3 px-7 rounded-lg transition-colors"
                >
                  Ver Papelaria
                </Link>
              </div>

              {/* Trust Badges Bar */}
              <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-6 border-t border-white/15 max-w-xl">
                <div>
                  <div className="text-lg sm:text-2xl font-bold text-white">Orçamento</div>
                  <div className="text-xs text-slate-300">online e claro</div>
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-bold text-[#9ed0ff]">Retirada</div>
                  <div className="text-xs text-slate-300">na loja em Passos</div>
                </div>
                <div>
                  <div className="text-lg sm:text-2xl font-bold text-white">Atendimento</div>
                  <div className="text-xs text-slate-300">humano no WhatsApp</div>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Print Showcase Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-xl overflow-hidden shadow-xl border border-white/20 bg-white p-2">
                <div className="relative rounded-lg overflow-hidden aspect-[4/3] bg-slate-800">
                  <Image
                    src="/images/hero-showcase.jpg"
                    alt="Impressão digital de alta qualidade"
                    fill
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    className="object-cover object-center"
                    priority
                  />
                  <div className="absolute inset-0 bg-slate-950/45" />
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <span className="inline-block text-xs font-bold uppercase tracking-wider bg-[#b4232d] px-2.5 py-1 rounded-md mb-1 shadow-sm">
                      Orçamento em Tempo Real
                    </span>
                    <p className="text-sm font-medium text-slate-200">
                      Envie PDF, DOCX ou Imagem e veja o valor instantâneo.
                    </p>
                  </div>
                </div>

                <div className="p-3 flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#1769aa]" /> Sem pedido mínimo</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#1769aa]" /> Pix ou Cartão</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-12 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#b4232d] mb-1 block">Catálogo Gráfico</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#13233b] font-serif">Serviços Gráficos</h2>
              <p className="text-slate-600 mt-1">Configure sua impressão sob medida com prévia de preço</p>
            </div>
            <Link href="/grafica" className="inline-flex min-h-11 items-center gap-1.5 text-[#0d2b5c] font-bold hover:text-[#b4232d] transition-colors">
              Ver todos os serviços <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {activeServices.map(service => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[#b4232d] mb-1 block">Papelaria & Escritório</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#13233b] font-serif">Nossos Produtos</h2>
            <p className="text-slate-600 mt-1">Suprimentos, cadernos, organizadores e materiais pronta entrega</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {activeCategories.map(category => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        </div>
      </section>

      {/* Differentials / Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-left">
            <div className="bg-white p-5 sm:p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-11 h-11 sm:w-14 sm:h-14 bg-[#e8f1fa] text-[#0d2b5c] rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                <Printer className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-[#13233b] mb-2 font-serif">Qualidade Digital</h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                Parque gráfico moderno com calibração precisa de cores e textos nítidos para apresentações impecáveis.
              </p>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-11 h-11 sm:w-14 sm:h-14 bg-red-50 text-[#b4232d] rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                <Clock className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-[#13233b] mb-2 font-serif">Entrega Ágil</h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                Retirada expressa na unidade ou entrega rápida via motoboy para você nunca perder prazos.
              </p>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-11 h-11 sm:w-14 sm:h-14 bg-[#e8f1fa] text-[#1769aa] rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                <ShieldCheck className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-[#13233b] mb-2 font-serif">Compra Segura</h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                Validação automática de arquivos, pagamento via Pix protegido e total confidencialidade dos documentos.
              </p>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-11 h-11 sm:w-14 sm:h-14 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center mb-4 sm:mb-6">
                <PhoneCall className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-[#13233b] mb-2 font-serif">Atendimento Próximo</h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                Fale com a nossa equipe pelo WhatsApp para tirar dúvidas e acompanhar cada pedido.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Especial / Orçamento Personalizado */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto bg-[#0d2b5c] rounded-xl p-10 md:p-14 shadow-lg text-white text-center">
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 font-serif">Tem um Pedido Especial?</h2>
            <p className="text-base sm:text-lg text-slate-200 mb-8 max-w-2xl mx-auto leading-relaxed">
              Grandes tiragens, encadernações especiais, adesivação personalizada ou materiais corporativos. Nossa equipe técnica atende você no WhatsApp.
            </p>
            <a 
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-3 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-lg shadow-md transition-colors"
            >
              <PhoneCall className="w-5 h-5" />
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
