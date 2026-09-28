import type { Metadata } from 'next';
import { PrivacyRequestForm } from '@/components/privacy/PrivacyRequestForm';

export const metadata: Metadata = { title: 'Direitos do titular', description: 'Canal para solicitações relacionadas a dados pessoais.' };

export default function DireitosTitularPage() {
  return <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.85fr_1.15fr]">
    <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b4232d]">Privacidade com protocolo</p><h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Exerça seus direitos</h1><p className="mt-5 text-lg leading-8 text-slate-600">Use este canal para confirmação, acesso, correção, eliminação quando aplicável, informações sobre compartilhamento ou outro tema de privacidade.</p><div className="mt-8 rounded-2xl bg-slate-900 p-5 text-sm leading-6 text-slate-200"><strong className="text-white">Segurança primeiro.</strong> O protocolo confirma o recebimento, mas não dá acesso aos dados. Antes de responder, a equipe verifica a identidade por um meio proporcional para não entregar informações a outra pessoa.</div><p className="mt-6 text-sm leading-6 text-slate-600">A LGPD prevê resposta simplificada imediata ou declaração completa em até 15 dias para confirmação e acesso. Outros pedidos são tratados conforme a natureza e a regulamentação aplicável.</p></div>
    <PrivacyRequestForm />
  </div>;
}
