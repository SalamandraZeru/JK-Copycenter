import React from 'react';
import Image from 'next/image';
import { MapPin, Clock, Phone, Award, CheckCircle, ExternalLink } from 'lucide-react';
import { StoreLocationMap } from '@/components/shared/StoreLocationMap';

export default function SobrePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm">
        
        {/* Banner com imagem */}
        <div className="h-64 sm:h-80 relative overflow-hidden">
          <Image
            src="/images/brand/jk-fachada-1440.webp"
            alt="Fachada da unidade JK Copycenter em Passos, Minas Gerais"
            fill
            sizes="(min-width: 1024px) 1024px, 100vw"
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-slate-950/55 flex items-end p-8">
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Sobre a JK Copycenter
            </h1>
          </div>
        </div>

        <div className="p-8 sm:p-12">
          <div className="max-w-3xl mb-12">
            <p className="text-xl text-slate-700 font-medium leading-relaxed mb-6">
              A <strong>JK Copycenter</strong> nasceu com a missão de descomplicar serviços gráficos e suprimentos de papelaria, combinando tecnologia ágil de orçamento online com atendimento humano e equipamentos industriais de alta definição.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Atendemos estudantes, profissionais liberais, escritórios e empresas em Passos e região com agilidade recorde de entrega, impressão sob demanda de apostilas, banners, adesivos, cartões de visita e encadernações.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="p-6 rounded-2xl bg-blue-50/50 border border-blue-100">
              <Award className="w-8 h-8 text-blue-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1">Qualidade Superior</h3>
              <p className="text-xs text-slate-600">Calibração precisa de cores e papéis de alta gramatura certificados.</p>
            </div>

            <div className="p-6 rounded-2xl bg-green-50/50 border border-green-100">
              <Clock className="w-8 h-8 text-green-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1">Velocidade Express</h3>
              <p className="text-xs text-slate-600">Produção ágil com retirada imediata ou entrega rápida.</p>
            </div>

            <div className="p-6 rounded-2xl bg-purple-50/50 border border-purple-100">
              <CheckCircle className="w-8 h-8 text-purple-600 mb-3" />
              <h3 className="font-bold text-slate-900 mb-1">Atendimento 100%</h3>
              <p className="text-xs text-slate-600">Suporte humanizado direto via WhatsApp para tirar dúvidas de arquivos.</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-6">Nossa Unidade</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-5 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Endereço da Loja</h3>
                    <p className="text-slate-600 text-sm">
                      Av. Jk, 270 - Jardim Colégio de Passos<br />
                      Passos - MG, CEP: 37901-000
                    </p>
                    <a 
                      href="https://share.google/3jStxc1OYvpfH5rJ2" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
                    >
                      Ver no Google Maps <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Horário de Funcionamento</h3>
                    <p className="text-slate-600 text-sm">
                      Segunda a Sexta: 09h00 às 18h00<br />
                      Sábados: 09h00 às 12h00<br />
                      Domingos e Feriados: Fechado
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Contato Direto & Redes</h3>
                    <p className="text-slate-600 text-sm">
                      WhatsApp: (35) 99106-6260<br />
                      Instagram: @jkcopycenter<br />
                      Facebook: /JKCopyCenter
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Componente de Mapa Interativo Estilizado e Imune a Bloqueios */}
            <StoreLocationMap />
          </div>
        </div>
      </div>
    </div>
  );
}
