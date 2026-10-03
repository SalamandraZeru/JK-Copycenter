'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { ArrowRight, Clock3, FileSearch, Loader2, MessagesSquare, Search } from 'lucide-react';

interface QuoteQueueItem {
  id: string;
  order_number: string;
  customer_name: string;
  created_at: string;
  quote_status: string;
  latest_quote_version: number;
  quote_expires_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Aguardando análise',
  negotiating: 'Em negociação',
  quoted: 'Proposta enviada',
  accepted: 'Aceito',
  declined: 'Recusado',
  expired: 'Expirado',
  cancelled: 'Cancelado',
};

const fetcher = async (url: string): Promise<QuoteQueueItem[]> => {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(body)) throw new Error(body?.error || 'Não foi possível carregar a fila.');
  return body;
};

export default function OrcamentosPage() {
  const [quoteStatus, setQuoteStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const params = new URLSearchParams({ kind: 'graphic_quote' });
  if (quoteStatus) params.set('quoteStatus', quoteStatus);
  if (search.trim()) params.set('q', search.trim());
  const { data, error, isLoading } = useSWR(`/api/admin/pedidos?${params.toString()}`, fetcher);

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#061a3b]">Atendimento gráfico</p>
        <h1 className="mt-1 flex items-center gap-3 font-serif text-3xl font-bold text-slate-950"><MessagesSquare className="h-7 w-7 text-[#061a3b]" aria-hidden="true" />Fila de orçamentos</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">Analise arquivos, registre uma proposta e acompanhe aceite, recusa ou expiração sem sobrescrever versões anteriores.</p>
      </header>

      <section aria-label="Filtros da fila" className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_15rem]">
        <label className="relative"><span className="sr-only">Buscar protocolo</span><Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar protocolo..." className="min-h-11 w-full rounded-xl border border-slate-300 bg-slate-50 pl-10 pr-3 text-sm" /></label>
        <label><span className="sr-only">Filtrar por status</span><select value={quoteStatus} onChange={(event) => setQuoteStatus(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold"><option value="">Todos os status</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </section>

      {isLoading ? <div className="grid min-h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-[#061a3b]" aria-label="Carregando" /></div> : error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">{error.message}</p> : !data?.length ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><FileSearch className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" /><h2 className="mt-3 text-lg font-bold text-slate-900">Nenhuma solicitação neste filtro</h2><p className="mt-1 text-sm text-slate-500">Novas solicitações aparecerão aqui após o protocolo ser criado.</p></section>
      ) : (
        <ul className="grid gap-3">
          {data.map((item) => (
            <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
              <Link href={`/admin/pedidos/${item.id}`} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div><div className="flex flex-wrap items-center gap-2"><strong className="font-mono text-[#061a3b]">#{item.order_number}</strong><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#061a3b]">{STATUS_LABELS[item.quote_status] || item.quote_status}</span>{item.latest_quote_version > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">v{item.latest_quote_version}</span>}</div><p className="mt-2 font-bold text-slate-950">{item.customer_name}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />Recebido em {new Date(item.created_at).toLocaleString('pt-BR')}{item.quote_expires_at ? ` · validade até ${new Date(item.quote_expires_at).toLocaleString('pt-BR')}` : ''}</p></div>
                <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0d2b5c] px-4 text-sm font-bold text-white">Analisar <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
