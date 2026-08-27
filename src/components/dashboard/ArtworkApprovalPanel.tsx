'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AlertTriangle, CheckCircle2, FileCheck2, Loader2, MessageSquareWarning, Upload } from 'lucide-react';
import { FileUploadDropzone, type UploadedFileItem } from '@/components/servico/FileUploadDropzone';

type ReportStatus = 'pending_review' | 'correction_requested' | 'awaiting_customer_approval' | 'approved_for_production' | 'superseded';

interface ArtworkReport {
  id: string;
  order_file_id: string;
  file_content_sha256: string;
  status: ReportStatus;
  customer_approval_required: boolean;
  staff_note: string | null;
  reviewed_at: string | null;
  order_files: { original_name: string; page_count: number; page_count_method: string; mime_type: string } | null;
}

interface ArtworkResponse {
  artworkStatus: string;
  reports: ArtworkReport[];
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar a revisão de arte.');
  return payload as ArtworkResponse;
};

const statusLabel: Record<ReportStatus, string> = {
  pending_review: 'Em revisão técnica',
  correction_requested: 'Correção solicitada',
  awaiting_customer_approval: 'Aguardando sua aprovação',
  approved_for_production: 'Aprovada para produção',
  superseded: 'Versão substituída',
};

export function ArtworkApprovalPanel({ orderId }: { orderId: string }) {
  const { data, error, isLoading, mutate } = useSWR<ArtworkResponse>(`/api/dashboard/pedidos/${orderId}/arte`, fetcher);
  const [note, setNote] = useState('');
  const [submittingReportId, setSubmittingReportId] = useState<string | null>(null);
  const [newFiles, setNewFiles] = useState<UploadedFileItem[]>([]);
  const [attachingReportId, setAttachingReportId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) {
    return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Carregando revisão de arte…</div>;
  }
  if (error) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">{error.message}</div>;
  }
  if (!data || data.reports.length === 0) return null;

  const decide = async (report: ArtworkReport, decision: 'approved' | 'correction_requested') => {
    if (decision === 'correction_requested' && !note.trim()) {
      setActionError('Explique brevemente a correção desejada antes de enviar sua solicitação.');
      return;
    }
    setSubmittingReportId(report.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/dashboard/pedidos/${orderId}/arte`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id, decision, note: note.trim() || undefined }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível registrar sua decisão.');
      setNote('');
      await mutate();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Não foi possível registrar sua decisão.');
    } finally {
      setSubmittingReportId(null);
    }
  };

  const attachRevision = async (report: ArtworkReport, fileId: string) => {
    setAttachingReportId(report.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/dashboard/pedidos/${orderId}/arte`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id, fileId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível enviar a nova versão para revisão.');
      setNewFiles([]);
      await mutate();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Não foi possível enviar a nova versão para revisão.');
    } finally {
      setAttachingReportId(null);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-blue-50 p-2 text-blue-700"><FileCheck2 className="h-5 w-5" /></div>
        <div>
          <h3 className="font-semibold text-slate-900">Pré-impressão e aprovação de arte</h3>
          <p className="mt-1 text-sm text-slate-600">A produção só começa após a arte aplicável ser liberada.</p>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {data.reports.map((report) => (
          <article key={report.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
              <div>
                <p className="font-semibold text-slate-900">{report.order_files?.original_name || 'Arquivo enviado'}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{statusLabel[report.status]}</p>
              </div>
              {report.status === 'approved_for_production' && <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Aprovada" />}
            </div>
            {report.staff_note && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><strong>Orientação da gráfica:</strong> {report.staff_note}</p>}
            <p className="mt-3 flex gap-2 text-xs leading-5 text-slate-600"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />A estrutura do arquivo é analisada, mas fontes, resolução, cor, transparências e área segura passam por revisão humana.</p>

            {report.status === 'awaiting_customer_approval' && report.customer_approval_required && (
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <label className="block text-sm font-medium text-slate-700">Observação (obrigatória somente ao pedir correção)</label>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Ex.: ajustar telefone, margem, cor…" />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" disabled={submittingReportId === report.id} onClick={() => decide(report, 'approved')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"><CheckCircle2 className="h-4 w-4" />Aprovar esta versão</button>
                  <button type="button" disabled={submittingReportId === report.id} onClick={() => decide(report, 'correction_requested')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 disabled:opacity-60"><MessageSquareWarning className="h-4 w-4" />Solicitar correção</button>
                </div>
              </div>
            )}

            {report.status === 'correction_requested' && (
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-800">Envie a versão corrigida. Ela será vinculada a este item e revisada novamente.</p>
                <FileUploadDropzone files={newFiles} onFilesChange={setNewFiles} onPageCountUpdate={() => undefined} />
                {newFiles.map((file) => <button key={file.fileId} type="button" disabled={attachingReportId === report.id} onClick={() => attachRevision(report, file.fileId)} className="mr-2 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"><Upload className="h-4 w-4" />Enviar “{file.originalName}” para revisão</button>)}
              </div>
            )}
          </article>
        ))}
      </div>
      {actionError && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-800">{actionError}</p>}
      {(submittingReportId || attachingReportId) && <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Registrando sua decisão…</p>}
    </section>
  );
}
