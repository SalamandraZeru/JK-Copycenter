'use client';

import React, { useState, use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils/format';
import { 
  ArrowLeft, Package, User, MapPin, Download, CheckCircle, 
  MessageCircle, Loader2, Save, FileText, Printer, PencilLine
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const STATUS_LABELS: Record<string, string> = {
  created: 'Criado',
  awaiting_payment: 'Aguardando pagamento',
  confirmed: 'Pagamento confirmado',
  in_production: 'Em Produção',
  ready: 'Pronto p/ Retirada',
  completed: 'Entregue / Concluído',
  cancelled: 'Cancelado',
};

const PAYMENT_LABELS: Record<string, string> = {
  pending_contact: 'Pendente de confirmação',
  paid: 'Pago',
  rejected: 'Rejeitado',
  cancelled: 'Cancelado',
};

function formatOrderFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.map(formatOrderFieldValue).join(', ');
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.valueLabel === 'string') return record.valueLabel;
    if (record.value !== undefined) return formatOrderFieldValue(record.value);
    return Object.entries(record)
      .map(([key, item]) => `${key}: ${formatOrderFieldValue(item)}`)
      .join(', ');
  }
  return '-';
}

function formatItemTechnicalDetails(item: { fields_snapshot?: unknown; pricing_rule_snapshot?: unknown }): string {
  const fields = item.fields_snapshot && typeof item.fields_snapshot === 'object' && !Array.isArray(item.fields_snapshot)
    ? Object.entries(item.fields_snapshot as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${formatOrderFieldValue(value)}`)
    : [];
  const pricing = item.pricing_rule_snapshot && typeof item.pricing_rule_snapshot === 'object' && !Array.isArray(item.pricing_rule_snapshot)
    ? item.pricing_rule_snapshot as Record<string, unknown>
    : null;
  const bindingSelections = Array.isArray(pricing?.bindingSelections) ? pricing.bindingSelections : [];
  if (bindingSelections.length > 0) {
    const pages = bindingSelections
      .map((selection) => selection && typeof selection === 'object' && typeof (selection as Record<string, unknown>).pageCount === 'number'
        ? `${(selection as Record<string, unknown>).pageCount} pág.`
        : null)
      .filter((value): value is string => value !== null);
    fields.push(`Encadernação: ${bindingSelections.length} ${bindingSelections.length === 1 ? 'arquivo' : 'arquivos'}${pages.length > 0 ? ` (${pages.join(', ')})` : ''}`);
  }
  const booklet = pricing?.bookletImposition;
  if (booklet && typeof booklet === 'object' && !Array.isArray(booklet)) {
    const data = booklet as Record<string, unknown>;
    if (typeof data.originalPageCount === 'number' && typeof data.imposedPageCount === 'number') {
      const blanks = typeof data.blankPagesAdded === 'number' && data.blankPagesAdded > 0
        ? ` (+${data.blankPagesAdded} técnica(s) em branco${data.customerApprovalRecorded === true ? ', aprovação registrada' : ''})`
        : '';
      fields.push(`Livreto: ${data.originalPageCount} páginas originais → ${data.imposedPageCount} produção${blanks}`);
    }
  }
  return fields.length > 0 ? fields.join(' | ') : 'Padrão';
}

export default function PedidoDetalhePage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const { data: order, error, isLoading, mutate } = useSWR(`/api/admin/pedidos/${params.id}`, fetcher);

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [paymentAction, setPaymentAction] = useState<'paid' | 'rejected' | 'cancelled'>('paid');
  const [operatorNote, setOperatorNote] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const [adjustmentItemId, setAdjustmentItemId] = useState('');
  const [adjustmentTotal, setAdjustmentTotal] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [updatingPrice, setUpdatingPrice] = useState(false);

  if (isLoading) return <div className="p-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" /></div>;
  if (error || !order) return <div className="p-20 text-center text-red-500">Erro ao carregar pedido.</div>;

  const isProductionView = order.operationView === 'production';
  const productionTargets: Record<string, string[]> = {
    confirmed: ['in_production'],
    in_production: ['ready'],
    ready: ['completed'],
  };
  const selectableStatuses = isProductionView
    ? productionTargets[order.status] || []
    : ['in_production', 'ready', 'completed', 'cancelled'];
  const productionBlockedByPayment = isProductionView && order.payment_status !== 'paid';

  const handleStatusChange = async () => {
    if (!newStatus || newStatus === order.status) return;
    
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/pedidos/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes: operatorNote, idempotencyKey: crypto.randomUUID() })
      });
      if (res.ok) {
        mutate();
        setNewStatus('');
      } else {
        alert('Erro ao atualizar status');
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePayment = async () => {
    if (!operatorNote.trim()) {
      alert('Informe a observação obrigatória da confirmação manual.');
      return;
    }
    setUpdatingPayment(true);
    try {
      const res = await fetch(`/api/admin/pedidos/${order.id}/pagamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: paymentAction,
          note: operatorNote,
          externalReference: externalReference.trim() || undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || 'Não foi possível registrar o pagamento.');
      }
      setOperatorNote('');
      setExternalReference('');
      await mutate();
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : 'Não foi possível registrar o pagamento.');
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handlePriceAdjustment = async () => {
    const parsedTotal = Number(adjustmentTotal.trim().replace(',', '.'));
    if (!adjustmentItemId || !Number.isFinite(parsedTotal) || parsedTotal < 0) {
      alert('Selecione um item e informe o novo total em reais.');
      return;
    }
    if (adjustmentReason.trim().length < 3) {
      alert('Explique o motivo do ajuste para registrar no pedido.');
      return;
    }

    setUpdatingPrice(true);
    try {
      const response = await fetch(`/api/admin/pedidos/${order.id}/preco`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderItemId: adjustmentItemId,
          newTotalCents: Math.round(parsedTotal * 100),
          reason: adjustmentReason.trim(),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok || result?.error) throw new Error(result?.error || 'Não foi possível ajustar o preço.');
      setAdjustmentItemId('');
      setAdjustmentTotal('');
      setAdjustmentReason('');
      await mutate();
    } catch (caught) {
      alert(caught instanceof Error ? caught.message : 'Não foi possível ajustar o preço.');
    } finally {
      setUpdatingPrice(false);
    }
  };

  const handlePrintOS = () => {
    window.print();
  };

  const handleOpenFile = async (fileId: string) => {
    const target = window.open('about:blank', '_blank');
    if (target) target.opener = null;
    setOpeningFileId(fileId);
    try {
      const response = await fetch(`/api/admin/arquivos/${fileId}/download`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success || typeof data.url !== 'string') throw new Error('Arquivo indisponível');
      if (target) target.location.href = data.url;
    } catch {
      target?.close();
      alert('Não foi possível emitir o acesso temporário ao arquivo.');
    } finally {
      setOpeningFileId(null);
    }
  };

  const customerName = order.customer_name || order.guest_name || order.profiles?.full_name || 'Cliente';
  const customerEmail = order.guest_email || order.profiles?.email || 'Não informado';
  const phone = (order.customer_phone || order.guest_phone || '').replace(/\D/g, '');
  const waMsg = encodeURIComponent(`Olá ${customerName}, referente ao seu pedido #${order.order_number} na JK Copycenter...`);
  const waUrl = phone ? `https://wa.me/55${phone}?text=${waMsg}` : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Action Header - Screen Only */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href={isProductionView ? '/admin/producao' : '/admin/pedidos'} className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Pedido #{order.order_number}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-blue-100 text-blue-800">
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
            <p className="text-sm text-slate-500">Realizado em {new Date(order.created_at).toLocaleString('pt-BR')}</p>
          </div>
        </div>

        {!isProductionView && <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrintOS}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4" />
            Imprimir O.S.
          </button>

          {waUrl && (
            <a 
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-xs"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
          )}
        </div>}
      </div>

      {/* PRINTABLE ORDEM DE SERVIÇO (Visible only in print mode) */}
      {!isProductionView && <div className="os-document hidden print:block font-sans text-slate-900 p-4 border border-black rounded-sm mb-6">
        <div className="border-b-2 border-black pb-4 mb-4 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">JK COPYCENTER</h1>
            <p className="text-xs font-semibold text-slate-700">Gráfica Rápida • Cópias • Impressões • Papelaria</p>
            <p className="text-xs text-slate-600 mt-1">Av. Jk, 270 - Jardim Colégio de Passos, Passos - MG, 37901-000</p>
            <p className="text-xs text-slate-600">WhatsApp/Tel: (35) 99106-6260</p>
          </div>
          <div className="text-right">
            <div className="border-2 border-black px-3 py-1 font-bold text-lg inline-block">
              O.S. #{order.order_number}
            </div>
            <p className="text-xs mt-1">Data: {new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
            <p className="text-xs font-bold uppercase text-slate-800">Status: {STATUS_LABELS[order.status] || order.status}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 border-b border-black pb-4 text-xs">
          <div>
            <h3 className="font-bold uppercase text-slate-900 border-b border-slate-300 pb-0.5 mb-1">Dados do Cliente</h3>
            <p><strong>Nome:</strong> {customerName}</p>
            <p><strong>Telefone:</strong> {order.customer_phone || order.guest_phone || '-'}</p>
            <p><strong>Email:</strong> {customerEmail}</p>
          </div>
          <div>
            <h3 className="font-bold uppercase text-slate-900 border-b border-slate-300 pb-0.5 mb-1">Entrega & Pagamento</h3>
            <p><strong>Tipo:</strong> {order.delivery_type === 'delivery' ? 'Entrega em Domicílio' : 'Retirada no Balcão'}</p>
            <p><strong>Forma Pag.:</strong> {order.payment_method?.toUpperCase() || 'PIX'}</p>
            <p><strong>Status Pag.:</strong> {PAYMENT_LABELS[order.payment_status] || order.payment_status}</p>
          </div>
        </div>

        <div className="mb-4">
          <h3 className="font-bold uppercase text-xs border-b border-black pb-1 mb-2">Itens e Especificações para Produção</h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1">Serviço / Produto</th>
                <th className="py-1">Especificações Técnicas</th>
                <th className="py-1 text-center">Páginas</th>
                <th className="py-1 text-center">Qtd</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(order.order_items || []).map((item: any) => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="py-2 font-bold">{item.service_name_snapshot || item.product_name_snapshot}</td>
                  <td className="py-2 text-slate-700">
                    {formatItemTechnicalDetails(item)}
                  </td>
                  <td className="py-2 text-center">{item.pages_count || item.page_count || 1}</td>
                  <td className="py-2 text-center font-bold">{item.quantity}</td>
                  <td className="py-2 text-right font-bold">{formatCurrency(item.total_price || item.unit_price * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-end border-t-2 border-black pt-3 text-xs">
          <div className="w-1/2">
            <p className="font-bold mb-8">Assinatura do Responsável / Cliente:</p>
            <div className="border-b border-black w-3/4"></div>
          </div>
          <div className="w-1/3 text-right space-y-1">
            <div className="flex justify-between"><span>Subtotal:</span> <span>{formatCurrency(order.subtotal)}</span></div>
            <div className="flex justify-between"><span>Taxa Entrega:</span> <span>{formatCurrency(order.delivery_fee)}</span></div>
            <div className="flex justify-between font-bold text-sm border-t border-black pt-1"><span>Total:</span> <span>{formatCurrency(order.total)}</span></div>
          </div>
        </div>
      </div>}

      {/* Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Itens do Pedido
            </h2>
            
            <div className="space-y-4">
              {(order.order_items || []).map((item: any) => (
                <div key={item.id} className="p-4 border border-slate-200 bg-slate-50/70 rounded-xl flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-900">{item.service_name_snapshot || item.product_name_snapshot}</h3>
                      {item.fields_snapshot && typeof item.fields_snapshot === 'object' && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {Object.entries(item.fields_snapshot).map(([key, val]) => (
                            <span key={key} className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-white border border-slate-300 text-slate-800">
                              {key}: {formatOrderFieldValue(val)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {!isProductionView && <div className="text-right">
                      <p className="font-bold text-slate-900">{formatCurrency(item.total_price || item.unit_price * item.quantity)}</p>
                      <p className="text-xs text-slate-500 font-medium">Qtd: {item.quantity}</p>
                    </div>}
                  </div>
                  {(item.pages_count || item.page_count) > 0 && (
                    <div className="mt-1 text-xs text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md inline-block w-fit font-semibold">
                      {item.pages_count || item.page_count} páginas por cópia
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!isProductionView && <div className="mt-6 pt-6 border-t border-slate-200 space-y-2">
              <div className="flex justify-between text-sm text-slate-600 font-medium">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600 font-medium">
                <span>Taxa de Entrega</span>
                <span>{formatCurrency(order.delivery_fee)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-100">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>}
          </div>

          {!isProductionView && Array.isArray(order.order_price_adjustments) && order.order_price_adjustments.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <PencilLine className="w-5 h-5 text-blue-600" /> Histórico de ajustes de valor
              </h2>
              <div className="space-y-3">
                {order.order_price_adjustments.map((adjustment: any) => (
                  <div key={adjustment.id} className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-bold text-slate-900">
                        Item: {formatCurrency(Number(adjustment.previous_item_total_cents) / 100)} → {formatCurrency(Number(adjustment.new_item_total_cents) / 100)}
                      </span>
                      <span className="text-xs font-medium text-slate-600">
                        {new Date(adjustment.created_at).toLocaleString('pt-BR')}{adjustment.admin_users?.full_name ? ` · ${adjustment.admin_users.full_name}` : ''}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700"><strong>Motivo:</strong> {adjustment.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Arquivos do Cliente com Download Direto e Impressão Nativa */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Arquivos do Cliente ({order.files?.length || 0})
              </h2>
            </div>
            
            {(!order.files || order.files.length === 0) ? (
              <p className="text-sm text-slate-500">Nenhum arquivo anexado a este pedido.</p>
            ) : (
              <div className="space-y-3">
                {order.files.map((file: { id: string; original_name: string; size_bytes: number; mime_type: string; status: string; expires_at: string | null }) => (
                  <div key={file.id} className="p-4 border border-slate-200 bg-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-slate-900 truncate" title={file.original_name}>
                          {file.original_name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span>{((file.size_bytes || 0) / (1024 * 1024)).toFixed(2)} MB</span>
                          <span>•</span>
                          <span className="uppercase font-semibold text-slate-600">{file.mime_type || 'Arquivo'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleOpenFile(file.id)}
                        disabled={openingFileId === file.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors border border-blue-200 disabled:opacity-50"
                        title="Emitir acesso temporário e abrir arquivo"
                      >
                        {openingFileId === file.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Download className="w-3.5 h-3.5" />}
                        Abrir arquivo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Gestão de Status</h2>
            
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Status Atual</p>
              <div className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-900 text-sm">
                {STATUS_LABELS[order.status] || order.status}
              </div>
            </div>

            {productionBlockedByPayment && (
              <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                Produção bloqueada: o pagamento ainda não foi confirmado.
              </p>
            )}

            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-800 block">Alterar para:</label>
              <textarea
                value={operatorNote}
                onChange={event => setOperatorNote(event.target.value)}
                placeholder="Observação obrigatória para a transição"
                maxLength={2000}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-medium text-slate-900 bg-white outline-none text-sm"
              />
              <select 
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 font-medium text-slate-900 bg-white outline-none text-sm"
              >
                <option value="">Selecione um novo status...</option>
                {Object.entries(STATUS_LABELS).filter(([key]) => selectableStatuses.includes(key)).map(([key, label]) => (
                  <option key={key} value={key} disabled={key === order.status}>{label}</option>
                ))}
              </select>
              <button 
                onClick={handleStatusChange}
                disabled={!newStatus || updatingStatus || productionBlockedByPayment}
                className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors hover:bg-blue-700 shadow-xs text-sm"
              >
                {updatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Atualizar Status
              </button>
            </div>
          </div>

          {!isProductionView && <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2"><PencilLine className="w-5 h-5 text-blue-600" /> Ajuste final do valor</h2>
            <p className="text-sm text-slate-600 mb-4">Use após revisar os arquivos ou conceder desconto. O motivo e os valores anterior/novo ficam registrados no pedido.</p>
            {order.payment_status !== 'pending_contact' ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">O valor fica bloqueado após a confirmação ou cancelamento do pagamento.</p>
            ) : (
              <div className="space-y-3">
                <select value={adjustmentItemId} onChange={(event) => {
                  const itemId = event.target.value;
                  setAdjustmentItemId(itemId);
                  const item = (order.order_items || []).find((candidate: any) => candidate.id === itemId);
                  if (item) setAdjustmentTotal(String(Number(item.total_price ?? (Number(item.total_price_cents ?? 0) / 100)).toFixed(2)));
                }} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white text-sm">
                  <option value="">Selecione o item...</option>
                  {(order.order_items || []).map((item: any) => <option key={item.id} value={item.id}>{item.service_name_snapshot || item.product_name_snapshot || 'Item'} — {formatCurrency(Number(item.total_price ?? (Number(item.total_price_cents ?? 0) / 100)))}</option>)}
                </select>
                <input value={adjustmentTotal} onChange={(event) => setAdjustmentTotal(event.target.value)} inputMode="decimal" placeholder="Novo total do item (R$)" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white text-sm" />
                <textarea value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} maxLength={2000} placeholder="Motivo obrigatório: desconto, página removida, revisão técnica..." className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white text-sm min-h-24" />
                <button onClick={handlePriceAdjustment} disabled={!adjustmentItemId || !adjustmentTotal.trim() || adjustmentReason.trim().length < 3 || updatingPrice} className="w-full py-2.5 bg-amber-600 text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors hover:bg-amber-700 text-sm">
                  {updatingPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : <PencilLine className="w-4 h-4" />}
                  Registrar ajuste
                </button>
              </div>
            )}
          </div>}

          {!isProductionView && <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Confirmação manual de pagamento</h2>
            <p className="text-sm text-slate-600 mb-4">Status atual: <strong>{PAYMENT_LABELS[order.payment_status] || order.payment_status}</strong></p>
            <div className="space-y-3">
              <select value={paymentAction} onChange={event => setPaymentAction(event.target.value as typeof paymentAction)} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white text-sm">
                <option value="paid">Confirmar como pago</option>
                <option value="rejected">Rejeitar pagamento</option>
                <option value="cancelled">Cancelar pagamento</option>
              </select>
              <input value={externalReference} onChange={event => setExternalReference(event.target.value)} maxLength={256} placeholder="Referência externa (opcional)" className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white text-sm" />
              <button onClick={handlePayment} disabled={order.payment_status !== 'pending_contact' || updatingPayment || !operatorNote.trim()} className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors hover:bg-emerald-700 text-sm">
                {updatingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Registrar pagamento
              </button>
            </div>
          </div>}

          {!isProductionView && <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Cliente
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</p>
                <p className="font-bold text-slate-900">{customerName}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</p>
                <p className="font-semibold text-slate-900 break-all">{customerEmail}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Telefone</p>
                <p className="font-semibold text-slate-900">{order.customer_phone || order.guest_phone || '-'}</p>
              </div>
            </div>
          </div>}

          {!isProductionView && order.delivery_type === 'delivery' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Endereço de Entrega
              </h2>
              <div className="text-sm text-slate-700 space-y-1">
                {order.delivery_address ? (
                  <>
                    <p className="font-semibold text-slate-900">{order.delivery_address.street}, {order.delivery_address.number}</p>
                    {order.delivery_address.complement && <p>{order.delivery_address.complement}</p>}
                    <p>{order.delivery_address.neighborhood}</p>
                    <p>{order.delivery_address.city} - {order.delivery_address.state}</p>
                    <p>CEP: {order.delivery_address.zipCode || order.delivery_address.zip_code}</p>
                  </>
                ) : (
                  <p className="text-slate-500">Endereço registrado no pedido.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
