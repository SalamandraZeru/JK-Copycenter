'use client';

import useSWR from 'swr';
import { ClipboardList, Loader2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(async (response) => {
  if (!response.ok) throw new Error('AUDIT_LOAD_FAILED');
  return response.json();
});

interface AuditEntry {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  entity: string;
}

function describeAction(action: string): string {
  return action.replace(/_/g, ' ');
}

export default function AuditoriaPage() {
  const { data, error, isLoading } = useSWR('/api/admin/auditoria?limit=50', fetcher);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><ClipboardList className="h-6 w-6 text-[#092653]" /> Auditoria operacional</h1>
        <p className="mt-1 text-sm text-slate-600">Eventos de configuração, preço, pagamento e fluxo de pedidos. Valores sensíveis não são exibidos.</p>
      </div>
      {isLoading ? <div className="flex justify-center p-20"><Loader2 className="h-8 w-8 animate-spin text-[#092653]" /></div> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-800">Não foi possível carregar a auditoria.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {(data?.data || []).length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-slate-500">Nenhum evento disponível.</p>
          ) : <>
            <ul className="divide-y divide-slate-100 md:hidden">
              {(data.data as AuditEntry[]).map((entry) => (
                <li key={entry.id} className="px-4 py-3 text-sm">
                  <p className="font-bold capitalize text-slate-900">{describeAction(entry.action)}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{entry.actor} · {entry.entity}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString('pt-BR')}</p>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Quando</th><th className="px-5 py-3">Responsável</th><th className="px-5 py-3">Ação</th><th className="px-5 py-3">Recurso</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {(data.data as AuditEntry[]).map((entry) => (
                    <tr key={entry.id}><td className="whitespace-nowrap px-5 py-4 text-slate-600">{new Date(entry.createdAt).toLocaleString('pt-BR')}</td><td className="px-5 py-4 font-medium text-slate-900">{entry.actor}</td><td className="px-5 py-4 capitalize text-slate-700">{describeAction(entry.action)}</td><td className="px-5 py-4 text-slate-600">{entry.entity}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>}
        </div>
      )}
    </div>
  );
}
