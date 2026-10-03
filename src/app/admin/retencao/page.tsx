'use client';

import useSWR from 'swr';
import { AlertTriangle, CheckCircle2, Clock3, HardDrive, Loader2, ShieldCheck } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(async (response) => {
  if (!response.ok) throw new Error('RETENTION_LOAD_FAILED');
  return response.json();
});

const RUN_STATUS: Record<string, string> = {
  completed: 'Concluído',
  running: 'Em andamento',
  failed: 'Falhou',
};

function runMode(mode: string): string {
  if (mode === 'execute') return 'Execução';
  if (mode === 'dry_run') return 'Simulação';
  return 'Relatório';
}

interface RetentionRun {
  id: string;
  mode: string;
  status: string;
  eligible_count: number;
  processed_count: number;
  deleted_count: number;
  missing_count: number;
  failed_count: number;
  started_at: string;
}

export default function RetencaoPage() {
  const { data, error, isLoading } = useSWR('/api/admin/retencao', fetcher, { refreshInterval: 60_000 });

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><ShieldCheck className="h-6 w-6 text-[#092653]" /> Retenção de arquivos</h1>
        <p className="mt-1 text-sm text-slate-600">Monitoramento agregado da eliminação física. Nomes e caminhos de arquivos não são exibidos.</p>
      </div>

      {isLoading ? <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-[#092653]" /></div> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-800">Não foi possível carregar o relatório.</div>
      ) : <>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5"><Clock3 className="h-5 w-5 text-[#092653]" /><p className="mt-2 text-[11px] font-bold uppercase leading-tight tracking-wide text-slate-500 sm:text-xs">Prazo</p><p className="mt-1 text-lg font-black text-slate-950 sm:text-2xl">{data.retentionDays} dias</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5"><HardDrive className="h-5 w-5 text-amber-600" /><p className="mt-2 text-[11px] font-bold uppercase leading-tight tracking-wide text-slate-500 sm:text-xs">Elegíveis</p><p className="mt-1 text-lg font-black text-slate-950 sm:text-2xl">{data.eligibleCount}</p></div>
          <div className={`rounded-xl border p-3 shadow-sm sm:p-5 ${data.failureCount ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>{data.failureCount ? <AlertTriangle className="h-5 w-5 text-rose-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}<p className="mt-2 text-[11px] font-bold uppercase leading-tight tracking-wide text-slate-500 sm:text-xs">Falhas</p><p className="mt-1 text-lg font-black text-slate-950 sm:text-2xl">{data.failureCount}</p></div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-4"><h2 className="font-bold text-slate-950">Execuções recentes</h2></div>
          {data.runs.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">Nenhuma execução registrada.</p>
          ) : <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {(data.runs as RetentionRun[]).map((run) => (
                <li key={run.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-slate-900">{runMode(run.mode)}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">{RUN_STATUS[run.status] || run.status}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{new Date(run.started_at).toLocaleString('pt-BR')}</p>
                  <p className="mt-1.5 text-xs text-slate-600">Elegíveis {run.eligible_count} · Eliminados {run.deleted_count} · Ausentes {run.missing_count} · Falhas {run.failed_count}</p>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Quando</th><th className="px-5 py-3">Modo</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3">Elegíveis</th><th className="px-5 py-3">Eliminados</th><th className="px-5 py-3">Ausentes</th><th className="px-5 py-3">Falhas</th></tr></thead><tbody className="divide-y divide-slate-100">{(data.runs as RetentionRun[]).map((run) => <tr key={run.id}><td className="whitespace-nowrap px-5 py-4 text-slate-600">{new Date(run.started_at).toLocaleString('pt-BR')}</td><td className="px-5 py-4 font-medium text-slate-900">{runMode(run.mode)}</td><td className="px-5 py-4 text-slate-700">{RUN_STATUS[run.status] || run.status}</td><td className="px-5 py-4">{run.eligible_count}</td><td className="px-5 py-4">{run.deleted_count}</td><td className="px-5 py-4">{run.missing_count}</td><td className="px-5 py-4">{run.failed_count}</td></tr>)}</tbody></table></div>
          </>}
        </div>
      </>}
    </div>
  );
}
