'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { CheckCircle2, Clock3, Loader2, MapPin, RefreshCw, XCircle } from 'lucide-react';
import { formatBrazilianZipCode, digitsOnly } from '@/lib/forms/brazil';
import { formatQuoteCurrency } from '@/lib/orders/manual-quote';

interface PublicQuoteItem {
  id: string;
  label_snapshot: string;
  quantity: number;
  unit_price_cents: number;
  total_price_cents: number;
}

interface PublicQuote {
  id: string;
  version: number;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  commercial_observation: string;
  change_reason: string | null;
  expires_at: string;
  created_at: string;
  order_quote_items: PublicQuoteItem[];
}

interface PublicQuotePayload {
  order: { id: string; orderNumber: string; quoteStatus: string; latestQuoteVersion: number };
  quotes: PublicQuote[];
}

interface QuoteDecisionPanelProps {
  orderId: string;
  requestCode?: string | null;
}

const blankAddress = { street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipCode: '' };

export function QuoteDecisionPanel({ orderId, requestCode }: QuoteDecisionPanelProps) {
  const fetcher = async (url: string): Promise<PublicQuotePayload> => {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: requestCode ? { 'x-quote-request-code': requestCode } : {},
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.data) throw new Error(body?.error || 'Não foi possível carregar a proposta.');
    return body.data;
  };
  const { data, error, isLoading, mutate } = useSWR(
    requestCode === null ? null : `/api/pedidos/${orderId}/orcamento`,
    fetcher,
  );
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'cash'>('pix');
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [address, setAddress] = useState(blankAddress);
  const [declineReason, setDeclineReason] = useState('');
  const [mode, setMode] = useState<'idle' | 'decline'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);
  const [renderedAt] = useState(() => Date.now());
  const actionKey = useRef<string | null>(null);

  useEffect(() => {
    if (deliveryType === 'pickup') setAddress(blankAddress);
  }, [deliveryType]);

  const lookupZip = async () => {
    const zip = digitsOnly(address.zipCode);
    if (zip.length !== 8) return;
    setLoadingCep(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`, { signal: controller.signal });
      clearTimeout(timeout);
      const result = await response.json();
      if (!response.ok || result.erro) throw new Error('CEP não encontrado.');
      setAddress((current) => ({ ...current, street: result.logradouro || '', neighborhood: result.bairro || '', city: result.localidade || '', state: result.uf || '' }));
    } catch {
      setFeedback('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
    } finally {
      setLoadingCep(false);
    }
  };

  const sendAction = async (action: 'accept' | 'decline') => {
    const latest = data?.quotes?.[0];
    if (!latest) return;
    if (action === 'decline' && declineReason.trim().length < 3) {
      setFeedback('Explique brevemente o motivo da recusa.');
      return;
    }
    actionKey.current ||= crypto.randomUUID();
    setSubmitting(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/pedidos/${orderId}/orcamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          quoteId: latest.id,
          expectedQuoteVersion: latest.version,
          idempotencyKey: actionKey.current,
          ...(requestCode ? { requestCode } : {}),
          ...(action === 'decline'
            ? { note: declineReason.trim() }
            : {
                paymentMethod,
                deliveryType,
                ...(deliveryType === 'delivery' ? { deliveryAddress: { ...address, zipCode: digitsOnly(address.zipCode), complement: address.complement.trim() || undefined } } : {}),
              }),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) throw new Error(body?.error || 'Não foi possível registrar sua resposta.');
      actionKey.current = null;
      setMode('idle');
      setFeedback(action === 'accept' ? 'Orçamento aceito. O pedido agora aguarda a confirmação do pagamento.' : 'Recusa registrada. A equipe poderá consultar seu motivo.');
      await mutate();
    } catch (caught) {
      setFeedback(caught instanceof Error ? caught.message : 'Não foi possível registrar sua resposta.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <section className="grid min-h-56 place-items-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="h-7 w-7 animate-spin text-blue-700" aria-label="Carregando proposta" /></section>;
  if (error) return <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"><h2 className="font-bold">Não foi possível abrir a proposta</h2><p className="mt-1 text-sm">{error.message}</p><button type="button" onClick={() => mutate()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 font-bold"><RefreshCw className="h-4 w-4" aria-hidden="true" />Tentar novamente</button></section>;
  if (!data) return null;

  const latest = data.quotes?.[0];
  if (!latest) return <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><h2 className="font-bold text-blue-950">Solicitação recebida</h2><p className="mt-1 text-sm text-blue-900">A equipe ainda está analisando os arquivos. O valor aparecerá aqui quando a proposta for registrada.</p></section>;

  const isExpired = new Date(latest.expires_at).getTime() <= renderedAt;
  const canRespond = data.order.quoteStatus === 'quoted' && !isExpired;
  return (
    <section aria-labelledby="customer-quote-title" className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Proposta comercial</p><h2 id="customer-quote-title" className="mt-1 text-2xl font-bold text-slate-950">Orçamento v{latest.version}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{latest.commercial_observation}</p></div>
        <div className="rounded-xl bg-[#0d2b5c] px-4 py-3 text-right text-white"><span className="block text-xs text-blue-200">Valor total</span><strong className="text-2xl">{formatQuoteCurrency(latest.total_cents)}</strong></div>
      </div>
      <p className={`mt-4 flex items-center gap-2 text-sm font-semibold ${isExpired ? 'text-red-700' : 'text-slate-600'}`}><Clock3 className="h-4 w-4" aria-hidden="true" />{isExpired ? 'Proposta expirada' : `Válida até ${new Date(latest.expires_at).toLocaleString('pt-BR')}`}</p>

      <ul className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200">
        {(latest.order_quote_items || []).map((item) => <li key={item.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between"><span className="font-semibold text-slate-900">{item.label_snapshot} · {item.quantity}x</span><strong>{formatQuoteCurrency(item.total_price_cents)}</strong></li>)}
        {latest.delivery_fee_cents > 0 && <li className="flex items-center justify-between p-3"><span>Entrega</span><strong>{formatQuoteCurrency(latest.delivery_fee_cents)}</strong></li>}
      </ul>

      {feedback && <p role="status" className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-950">{feedback}</p>}

      {canRespond ? (
        <div className="mt-6 space-y-5">
          {mode === 'decline' ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4"><label className="text-sm font-bold text-red-950">Por que esta proposta não atende?<textarea value={declineReason} onChange={(event) => { actionKey.current = null; setDeclineReason(event.target.value); }} rows={3} maxLength={2000} className="mt-2 w-full rounded-lg border border-red-300 bg-white p-3 text-slate-900" /></label><div className="mt-3 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => sendAction('decline')} disabled={submitting} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 font-bold text-white disabled:opacity-60"><XCircle className="h-4 w-4" aria-hidden="true" />Confirmar recusa</button><button type="button" onClick={() => setMode('idle')} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 font-bold text-slate-700">Voltar</button></div></div>
          ) : (
            <>
              <fieldset><legend className="text-sm font-bold text-slate-900">Como prefere receber?</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{(['pickup', 'delivery'] as const).map((value) => <label key={value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 font-semibold ${deliveryType === value ? 'border-blue-500 bg-blue-50 text-blue-950' : 'border-slate-300'}`}><input type="radio" name="delivery-type" value={value} checked={deliveryType === value} onChange={() => { actionKey.current = null; setDeliveryType(value); }} />{value === 'pickup' ? 'Retirada na loja' : 'Entrega no endereço'}</label>)}</div></fieldset>
              {deliveryType === 'delivery' && <fieldset className="rounded-xl border border-slate-200 bg-slate-50 p-4"><legend className="px-1 text-sm font-bold text-slate-900">Endereço final de entrega</legend><div className="mt-2 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">CEP<span className="mt-1 flex rounded-lg border border-slate-300 bg-white"><input value={formatBrazilianZipCode(address.zipCode)} onChange={(event) => { actionKey.current = null; setAddress((current) => ({ ...current, zipCode: digitsOnly(event.target.value).slice(0, 8) })); }} onBlur={lookupZip} inputMode="numeric" className="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-3 focus:ring-0" />{loadingCep && <Loader2 className="m-3 h-4 w-4 animate-spin" aria-hidden="true" />}</span></label><label className="text-sm font-semibold">Rua<input value={address.street} onChange={(event) => setAddress((current) => ({ ...current, street: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-sm font-semibold">Número<input value={address.number} onChange={(event) => setAddress((current) => ({ ...current, number: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-sm font-semibold">Complemento<input value={address.complement} onChange={(event) => setAddress((current) => ({ ...current, complement: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-sm font-semibold">Bairro<input value={address.neighborhood} onChange={(event) => setAddress((current) => ({ ...current, neighborhood: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-sm font-semibold">Cidade<input value={address.city} onChange={(event) => setAddress((current) => ({ ...current, city: event.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" /></label><label className="text-sm font-semibold">UF<input value={address.state} onChange={(event) => setAddress((current) => ({ ...current, state: event.target.value.toUpperCase().slice(0, 2) }))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 uppercase" /></label></div><p className="mt-3 flex items-center gap-2 text-xs text-slate-600"><MapPin className="h-4 w-4" aria-hidden="true" />O endereço só é registrado após o aceite.</p></fieldset>}
              <fieldset><legend className="text-sm font-bold text-slate-900">Forma de pagamento pretendida</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{([['pix', 'PIX'], ['card', 'Cartão'], ['cash', 'Dinheiro']] as const).map(([value, label]) => <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-semibold ${paymentMethod === value ? 'border-blue-500 bg-blue-50' : 'border-slate-300'}`}><input type="radio" name="payment-method" checked={paymentMethod === value} onChange={() => { actionKey.current = null; setPaymentMethod(value); }} />{label}</label>)}</div></fieldset>
              <div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => sendAction('accept')} disabled={submitting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}Aceitar orçamento</button><button type="button" onClick={() => setMode('decline')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 font-bold text-red-700 hover:bg-red-50"><XCircle className="h-5 w-5" aria-hidden="true" />Recusar</button></div>
            </>
          )}
        </div>
      ) : <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Status atual: {data.order.quoteStatus}. Nenhuma nova resposta é necessária nesta tela.</p>}

      {data.quotes.length > 1 && <details className="mt-6 border-t border-slate-200 pt-4"><summary className="cursor-pointer font-bold text-slate-800">Comparar versões anteriores</summary><ul className="mt-3 space-y-2">{data.quotes.slice(1).map((quote) => <li key={quote.id} className="rounded-lg bg-slate-50 p-3 text-sm"><strong>v{quote.version} · {formatQuoteCurrency(quote.total_cents)}</strong>{quote.change_reason && <p className="mt-1 text-slate-600">Substituída por: {latest.change_reason || 'nova revisão comercial'}</p>}</li>)}</ul></details>}
    </section>
  );
}
