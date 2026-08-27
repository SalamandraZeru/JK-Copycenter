'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { CheckCircle2, FileSearch, Loader2, Send, Undo2 } from 'lucide-react';

type ReviewStatus = 'pending_review' | 'correction_requested' | 'awaiting_customer_approval' | 'approved_for_production' | 'superseded';

interface Report {
  id: string;
  status: ReviewStatus;
  staff_note: string | null;
  customer_approval_required: boolean;
  order_files: { original_name: string; page_count: number; page_count_method: string; mime_type: string } | null;
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erro ao carregar pré-impressão.');
  return data as { reports: Report[] };
};

const labels: Record<ReviewStatus, string> = {
  pending_review: 'Pendente de revisão',
  correction_requested: 'Correção solicitada',
  awaiting_customer_approval: 'Aguardando cliente',
  approved_for_production: 'Liberada para produção',
  superseded: 'Versão substituída',
};

export function PreflightReviewPanel({ orderId, onUpdated }: { orderId: string; onUpdated?: () => void }) {
  const { data, error, isLoading, mutate } = useSWR(`/api/admin/pedidos/${orderId}/preflight`, fetcher);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [allowDirect, setAllowDirect] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const review = async (report: Report, status: 'correction_requested' | 'awaiting_customer_approval' | 'approved_for_production') => {
    const staffNote = (notes[report.id] ?? report.staff_note ?? '').trim();
    if (!staffNote) {
      setActionError('Registre uma orientação ou resultado técnico antes de atualizar a revisão.');
      return;
    }
    const customerApprovalRequired = status === 'approved_for_production' ? !allowDirect[report.id] : status === 'awaiting_customer_approval';
    setWorkingId(report.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/pedidos/${orderId}/preflight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id, status, staffNote, customerApprovalRequired }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível atualizar a pré-impressão.');
      await mutate();
      onUpdated?.();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Não foi possível atualizar a pré-impressão.');
    } finally {
      setWorkingId(null);
    }
  };

  if (isLoading) return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Carregando pré-impressão…</div>;
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error.message}</div>;
  if (!data || data.reports.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-start gap-3">
        <FileSearch className="mt-0.5 h-5 w-5 text-blue-600" />
        <div><h2 className="text-lg font-bold text-slate-900">Pré-impressão</h2><p className="text-sm text-slate-600">Arquivos só podem seguir para produção após esta liberação.</p></div>
      </div>
      <div className="mt-5 space-y-4">
        {data.reports.map((report) => (
          <div key={report.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-slate-900">{report.order_files?.original_name || 'Arquivo'}</strong><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{labels[report.status]}</span></div>
            <p className="mt-2 text-xs leading-5 text-slate-600">Análise estrutural automática disponível. Fontes, resolução, cores, transparências e área segura exigem conferência humana.</p>
            {report.status !== 'superseded' && report.status !== 'approved_for_production' && (
              <div className="mt-4 space-y-3">
                <textarea value={notes[report.id] ?? report.staff_note ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))} maxLength={2000} placeholder="Parecer técnico ou instruções para o cliente" className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={workingId === report.id} onClick={() => review(report, 'correction_requested')} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 disabled:opacity-60"><Undo2 className="h-4 w-4" />Pedir correção</button>
                  <button type="button" disabled={workingId === report.id} onClick={() => review(report, 'awaiting_customer_approval')} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"><Send className="h-4 w-4" />Enviar para aprovação</button>
                </div>
                <label className="flex items-start gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={Boolean(allowDirect[report.id])} onChange={(event) => setAllowDirect((current) => ({ ...current, [report.id]: event.target.checked }))} className="mt-0.5 h-4 w-4" />Dispensar aprovação do cliente nesta versão (uso interno, já aprovado em outro canal).</label>
                {allowDirect[report.id] && <button type="button" disabled={workingId === report.id} onClick={() => review(report, 'approved_for_production')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"><CheckCircle2 className="h-4 w-4" />Liberar diretamente para produção</button>}
              </div>
            )}
          </div>
        ))}
      </div>
      {actionError && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{actionError}</p>}
      {workingId && <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Salvando revisão…</p>}
    </section>
  );
}
