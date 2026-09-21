'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Copy, ExternalLink, History, Loader2, MessageCircle, Send, ShieldCheck } from 'lucide-react';
import { formatQuoteCurrency } from '@/lib/orders/manual-quote';
import { normalizeWhatsAppRecipient } from '@/lib/orders/status-communication';

interface QuoteOrderItem {
  id: string;
  quantity: number;
  service_name_snapshot: string | null;
}

interface QuoteVersionItem {
  id: string;
  order_item_id: string;
  label_snapshot: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
}

interface QuoteVersion {
  id: string;
  version: number;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  commercial_observation: string;
  change_reason: string | null;
  expires_at: string;
  created_at: string;
  admin_users?: { full_name?: string | null } | null;
  order_quote_items?: QuoteVersionItem[];
}

interface QuoteManagementOrder {
  id: string;
  order_number: string;
  quote_status: string;
  latest_quote_version: number;
  guest_phone?: string | null;
  customer_phone?: string | null;
  order_items?: QuoteOrderItem[];
  quotes?: QuoteVersion[];
  quoteCustomerActionPath?: string | null;
}

interface QuoteManagementPanelProps {
  order: QuoteManagementOrder;
  onUpdated: () => Promise<unknown> | unknown;
}

function dateTimeLocal(days = 7): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function centsFromInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
}

function moneyInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function QuoteManagementPanel({ order, onUpdated }: QuoteManagementPanelProps) {
  const latest = order.quotes?.[0];
  const operation = order.latest_quote_version > 0 ? 'revise' : 'issue';
  const canEdit = ['pending', 'negotiating', 'quoted'].includes(order.quote_status);
  const [values, setValues] = useState<Record<string, string>>({});
  const [deliveryFee, setDeliveryFee] = useState('0,00');
  const [observation, setObservation] = useState('Orçamento sujeito à conferência final dos arquivos antes da produção.');
  const [changeReason, setChangeReason] = useState('');
  const [expiresAt, setExpiresAt] = useState(dateTimeLocal());
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const latestItems = new Map((latest?.order_quote_items || []).map((item) => [item.order_item_id, item.unit_price_cents]));
    setValues(Object.fromEntries((order.order_items || []).map((item) => [item.id, moneyInput(latestItems.get(item.id) ?? 0)])));
    setDeliveryFee(moneyInput(latest?.delivery_fee_cents ?? 0));
    if (latest?.commercial_observation) setObservation(latest.commercial_observation);
    setExpiresAt(dateTimeLocal());
    setChangeReason('');
  }, [latest?.id, latest?.commercial_observation, latest?.delivery_fee_cents, latest?.order_quote_items, order.order_items]);

  const preview = useMemo(() => {
    const subtotal = (order.order_items || []).reduce((sum, item) => {
      const unit = centsFromInput(values[item.id] || '');
      return sum + (unit === null ? 0 : unit * item.quantity);
    }, 0);
    const fee = centsFromInput(deliveryFee) ?? 0;
    return { subtotal, fee, total: subtotal + fee };
  }, [deliveryFee, order.order_items, values]);

  const submit = async () => {
    setFeedback(null);
    const items = (order.order_items || []).map((item) => ({
      orderItemId: item.id,
      unitPriceCents: centsFromInput(values[item.id] || ''),
    }));
    if (items.some((item) => item.unitPriceCents === null) || preview.subtotal <= 0) {
      setFeedback({ type: 'error', message: 'Informe valores válidos. O subtotal precisa ser maior que zero.' });
      return;
    }
    if (observation.trim().length < 3 || (operation === 'revise' && changeReason.trim().length < 3)) {
      setFeedback({ type: 'error', message: operation === 'revise' ? 'Inclua a observação e o motivo da revisão.' : 'Inclua uma observação comercial.' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/pedidos/${order.id}/orcamentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          expectedQuoteVersion: order.latest_quote_version,
          idempotencyKey: crypto.randomUUID(),
          commercialObservation: observation.trim(),
          ...(operation === 'revise' ? { changeReason: changeReason.trim() } : {}),
          expiresAt: new Date(expiresAt).toISOString(),
          deliveryFeeCents: centsFromInput(deliveryFee),
          items: items.map((item) => ({ ...item, unitPriceCents: item.unitPriceCents! })),
        }),
      });
      const payload = await response.json().catch(() => null) as {
        error?: string;
        data?: { quote_version: number; whatsappMessage?: string };
      } | null;
      if (!response.ok || !payload?.data) throw new Error(payload?.error || 'Não foi possível salvar a proposta.');
      setWhatsappMessage(payload.data.whatsappMessage || '');
      setFeedback({ type: 'success', message: `Proposta v${payload.data.quote_version} registrada sem sobrescrever o histórico.` });
      setCopied(false);
      await onUpdated();
    } catch (caught) {
      setFeedback({ type: 'error', message: caught instanceof Error ? caught.message : 'Não foi possível salvar a proposta.' });
    } finally {
      setSubmitting(false);
    }
  };

  const copyMessage = async () => {
    if (!whatsappMessage) return;
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopied(true);
    } catch {
      setFeedback({ type: 'error', message: 'Não foi possível copiar automaticamente. Selecione a mensagem abaixo.' });
    }
  };

  const recipient = normalizeWhatsAppRecipient(order.customer_phone || order.guest_phone);
  const whatsappUrl = recipient && whatsappMessage
    ? `https://wa.me/${recipient}?text=${encodeURIComponent(whatsappMessage)}`
    : null;

  return (
    <section aria-labelledby="quote-management-title" className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Orçamento manual</p>
          <h2 id="quote-management-title" className="mt-1 text-xl font-bold text-slate-950">{operation === 'issue' ? 'Registrar primeira proposta' : `Criar revisão v${order.latest_quote_version + 1}`}</h2>
          <p className="mt-1 text-sm text-slate-600">Cada envio cria uma versão imutável. O valor só vira preço do pedido depois do aceite do cliente.</p>
        </div>
        <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold uppercase text-slate-700">{order.quote_status}</span>
      </div>

      {canEdit ? (
        <div className="mt-6 space-y-5">
          <fieldset>
            <legend className="text-sm font-bold text-slate-900">Valores por item</legend>
            <div className="mt-3 space-y-3">
              {(order.order_items || []).map((item) => (
                <label key={item.id} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center">
                  <span className="text-sm font-semibold text-slate-800">{item.service_name_snapshot || 'Serviço gráfico'} <small className="block font-normal text-slate-500">Quantidade: {item.quantity}</small></span>
                  <span className="flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-500">R$<input aria-label={`Valor unitário de ${item.service_name_snapshot || 'serviço'}`} value={values[item.id] || ''} onChange={(event) => setValues((current) => ({ ...current, [item.id]: event.target.value }))} inputMode="decimal" className="min-w-0 flex-1 border-0 bg-transparent text-right text-slate-950 focus:ring-0" /></span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-800">Taxa de entrega (R$)<input value={deliveryFee} onChange={(event) => setDeliveryFee(event.target.value)} inputMode="decimal" className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
            <label className="text-sm font-semibold text-slate-800">Validade<input type="datetime-local" value={expiresAt} min={dateTimeLocal(0)} onChange={(event) => setExpiresAt(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label>
          </div>

          <label className="block text-sm font-semibold text-slate-800">Observação da proposta *<textarea value={observation} onChange={(event) => setObservation(event.target.value)} maxLength={4000} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 p-3" /></label>
          {operation === 'revise' && <label className="block text-sm font-semibold text-slate-800">Motivo desta alteração *<textarea value={changeReason} onChange={(event) => setChangeReason(event.target.value)} maxLength={2000} rows={2} placeholder="Ex.: cliente alterou acabamento ou recebeu desconto" className="mt-1.5 w-full rounded-lg border border-amber-300 bg-amber-50 p-3" /></label>}

          <dl className="grid gap-2 rounded-xl bg-[#0d2b5c] p-4 text-white sm:grid-cols-3">
            <div><dt className="text-xs text-blue-200">Subtotal</dt><dd className="text-lg font-bold">{formatQuoteCurrency(preview.subtotal)}</dd></div>
            <div><dt className="text-xs text-blue-200">Entrega</dt><dd className="text-lg font-bold">{formatQuoteCurrency(preview.fee)}</dd></div>
            <div><dt className="text-xs text-blue-200">Total</dt><dd className="text-xl font-black">{formatQuoteCurrency(preview.total)}</dd></div>
          </dl>

          {feedback && <p role="alert" className={`rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-800'}`}>{feedback.message}</p>}

          <button type="button" onClick={submit} disabled={submitting} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800 disabled:opacity-60">
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Send className="h-5 w-5" aria-hidden="true" />}
            {operation === 'issue' ? 'Registrar proposta' : 'Registrar nova versão'}
          </button>
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">O estado atual bloqueia novas versões desta proposta.</p>
      )}

      {whatsappMessage && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 font-bold text-emerald-950"><MessageCircle className="h-5 w-5" aria-hidden="true" /> Mensagem pronta para o cliente</div>
          <textarea value={whatsappMessage} readOnly rows={7} onFocus={(event) => event.currentTarget.select()} className="mt-3 w-full rounded-lg border border-emerald-200 bg-white p-3 text-sm text-slate-800" />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={copyMessage} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 font-bold text-emerald-800"><Copy className="h-4 w-4" aria-hidden="true" />{copied ? 'Mensagem copiada' : 'Copiar mensagem'}</button>
            {whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 font-bold text-white"><ExternalLink className="h-4 w-4" aria-hidden="true" />Abrir WhatsApp</a>}
          </div>
        </div>
      )}

      {order.quoteCustomerActionPath && <a href={order.quoteCustomerActionPath} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:underline"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Visualizar página segura de decisão</a>}

      {(order.quotes || []).length > 0 && (
        <div className="mt-7 border-t border-slate-200 pt-6">
          <h3 className="flex items-center gap-2 font-bold text-slate-950"><History className="h-5 w-5 text-blue-700" aria-hidden="true" />Histórico de propostas</h3>
          <div className="mt-3 space-y-3">
            {(order.quotes || []).map((quote) => (
              <details key={quote.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4" open={quote.version === order.latest_quote_version}>
                <summary className="cursor-pointer list-none font-bold text-slate-900">
                  <span className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />Versão {quote.version}</span><span>{formatQuoteCurrency(quote.total_cents)}</span></span>
                </summary>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p>{quote.commercial_observation}</p>
                  {quote.change_reason && <p><strong>Motivo:</strong> {quote.change_reason}</p>}
                  <p className="flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />Criada em {new Date(quote.created_at).toLocaleString('pt-BR')} · válida até {new Date(quote.expires_at).toLocaleString('pt-BR')}{quote.admin_users?.full_name ? ` · ${quote.admin_users.full_name}` : ''}</p>
                  <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white px-3">
                    {(quote.order_quote_items || []).map((item) => <li key={item.id} className="flex justify-between gap-3 py-2"><span>{item.label_snapshot} · {item.quantity}x</span><strong>{formatQuoteCurrency(item.total_price_cents)}</strong></li>)}
                  </ul>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
