'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { AlertCircle, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { useCartStore } from '@/lib/cart/store';
import { createClient } from '@/lib/supabase/client';
import { digitsOnly, formatBrazilianPhone, formatBrazilianZipCode } from '@/lib/forms/brazil';
import type { DeliveryType, PaymentMethod } from '@/types';
import type { CheckoutPayload, CheckoutQuote, CheckoutResult } from '@/types/checkout';
import { formatCurrency } from '@/lib/utils/format';

interface CheckoutSettings {
  delivery_fee_cents: number;
  delivery_city: string;
  delivery_state: string;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ViaCepResponse {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

function currentIdempotencyKey(ref: React.MutableRefObject<string | null>): string {
  const stored = sessionStorage.getItem('jk_checkout_idempotency_key');
  const isUuid = stored && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(stored);
  const key = ref.current || (isUuid ? stored : crypto.randomUUID());
  ref.current = key;
  sessionStorage.setItem('jk_checkout_idempotency_key', key);
  return key;
}

function quoteFingerprint(payload: CheckoutPayload): string {
  return JSON.stringify({
    items: payload.items.map((item) => ({
      serviceId: item.serviceId || null,
      productId: item.productId || null,
      attributeIds: item.attributeIds,
      fieldValues: item.fieldValues.map(({ fieldKey, value }) => ({ fieldKey, value })),
      pageCount: item.pageCount,
      isFrontAndBack: item.isFrontAndBack,
      quantity: item.quantity,
      fileIds: item.fileIds,
      bindingFileIds: item.bindingFileIds ?? [],
      dimensions: item.dimensions ?? {},
      bookletPaddingApproved: Boolean(item.bookletPaddingApproved),
    })),
    deliveryType: payload.deliveryType,
    deliveryAddress: payload.deliveryAddress || null,
    deliveryAddressId: payload.deliveryAddressId || null,
    customerName: payload.customerName || null,
    customerPhone: payload.customerPhone || null,
    guestEmail: payload.guestEmail || null,
    paymentMethod: payload.paymentMethod,
  });
}

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const restoreSessionFiles = useCartStore((state) => state.restoreSessionFiles);
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [checkoutSettings, setCheckoutSettings] = useState<CheckoutSettings | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const lookupAbortRef = useRef<AbortController | null>(null);

  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [zipLookupMessage, setZipLookupMessage] = useState<string | null>(null);

  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteSignature, setQuoteSignature] = useState<string | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    restoreSessionFiles();
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data }) => {
      const activeSession = data.session;
      setSession(activeSession);
      if (!activeSession?.user) return;
      if (activeSession.user.email) setGuestEmail(activeSession.user.email);
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', activeSession.user.id)
          .single();
        if (profile?.full_name) setGuestName(profile.full_name);
        if (profile?.phone) setGuestPhone(digitsOnly(profile.phone));
      } catch {
        // The form remains available if a profile has not been created yet.
      }
    });
  }, [restoreSessionFiles]);

  useEffect(() => {
    fetch('/api/store/checkout-settings')
      .then(async (response) => {
        if (!response.ok) throw new Error('Configuração de entrega indisponível.');
        return response.json() as Promise<CheckoutSettings>;
      })
      .then((settings) => {
        setCheckoutSettings(settings);
        if (!settings.pickup_enabled && settings.delivery_enabled) setDeliveryType('delivery');
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : 'Configuração de entrega indisponível.');
      });
  }, []);

  useEffect(() => {
    if (mounted && items.length === 0 && !isSubmitting) router.replace('/carrinho');
  }, [isSubmitting, items.length, mounted, router]);

  useEffect(() => {
    lookupAbortRef.current?.abort();
    if (deliveryType !== 'delivery' || zipCode.length !== 8) {
      setZipLookupMessage(null);
      return;
    }

    const controller = new AbortController();
    lookupAbortRef.current = controller;
    const timer = window.setTimeout(async () => {
      setZipLookupMessage('Buscando endereço pelo CEP…');
      try {
        const response = await fetch(`https://viacep.com.br/ws/${zipCode}/json/`, { signal: controller.signal });
        if (!response.ok) throw new Error('Falha ao consultar o CEP.');
        const result = await response.json() as ViaCepResponse;
        if (result.erro) {
          setZipLookupMessage('CEP não encontrado. Preencha o endereço manualmente.');
          return;
        }
        if (checkoutSettings && (
          result.localidade !== checkoutSettings.delivery_city
          || result.uf !== checkoutSettings.delivery_state
        )) {
          setZipLookupMessage('Este CEP está fora da área de entrega. Você ainda pode alterar para retirada.');
          return;
        }
        setStreet((current) => current || result.logradouro || '');
        setNeighborhood((current) => current || result.bairro || '');
        setZipLookupMessage('Endereço encontrado. Confirme rua, número e bairro.');
      } catch (caught) {
        if (caught instanceof Error && caught.name === 'AbortError') return;
        setZipLookupMessage('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [checkoutSettings, deliveryType, zipCode]);

  if (!mounted || items.length === 0) return null;

  const checkoutBlocked = items.some((item) => item.revalidationStatus !== 'ready');
  const hasFiles = items.some((item) => item.fileIds.length > 0);

  const buildPayload = (): CheckoutPayload => {
    if (!checkoutSettings) throw new Error('Configuração de entrega indisponível.');
    if (deliveryType === 'delivery' && !checkoutSettings.delivery_enabled) {
      throw new Error('Entrega temporariamente indisponível.');
    }
    if (deliveryType === 'pickup' && !checkoutSettings.pickup_enabled) {
      throw new Error('Retirada temporariamente indisponível.');
    }
    return {
      idempotencyKey: currentIdempotencyKey(idempotencyKeyRef),
      items: items.map((item) => ({
        ...(item.serviceId ? { serviceId: item.serviceId } : {}),
        ...(item.productId ? { productId: item.productId } : {}),
        attributeIds: item.attributeIds,
        fieldValues: item.fieldValues,
        pageCount: item.pageCount,
        isFrontAndBack: item.isFrontAndBack,
        quantity: item.quantity,
        fileIds: item.fileIds,
        bindingFileIds: item.bindingFileIds ?? [],
        dimensions: item.dimensions ?? {},
        bookletPaddingApproved: Boolean(item.bookletPaddingApproved),
      })),
      deliveryType,
      paymentMethod,
      ...(deliveryType === 'delivery' ? {
        deliveryAddress: {
          street,
          number,
          ...(complement.trim() ? { complement: complement.trim() } : {}),
          neighborhood,
          city: checkoutSettings.delivery_city,
          state: checkoutSettings.delivery_state,
          zipCode,
        },
      } : {}),
      ...(guestName.trim() ? { customerName: guestName.trim() } : {}),
      ...(guestPhone ? { customerPhone: guestPhone } : {}),
      ...(guestEmail.trim() ? { guestEmail: guestEmail.trim().toLowerCase() } : {}),
    };
  };

  const requestQuote = async (payload: CheckoutPayload): Promise<boolean> => {
    setIsQuoting(true);
    setError(null);
    try {
      const response = await fetch('/api/checkout/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as ApiResponse<CheckoutQuote>;
      if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Não foi possível atualizar a cotação.');
      setQuote(result.data);
      setQuoteSignature(quoteFingerprint(payload));
      return true;
    } catch (caught) {
      setQuote(null);
      setQuoteSignature(null);
      setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar a cotação.');
      return false;
    } finally {
      setIsQuoting(false);
    }
  };

  const handleRefreshQuote = async () => {
    if (!formRef.current?.reportValidity()) return;
    try {
      await requestQuote(buildPayload());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível atualizar a cotação.');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (checkoutBlocked) {
      setError('Volte ao carrinho e conclua a atualização dos itens antes de finalizar.');
      return;
    }

    let payload: CheckoutPayload;
    try {
      payload = buildPayload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dados de checkout inválidos.');
      return;
    }
    const signature = quoteFingerprint(payload);
    if (!quote || quoteSignature !== signature) {
      const refreshed = await requestQuote(payload);
      if (refreshed) setError('Cotação final atualizada. Confira os valores e clique em “Criar pedido” para confirmar.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as ApiResponse<CheckoutResult>;
      if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'Não foi possível concluir o pedido.');

      sessionStorage.setItem('jk_checkout_confirmation', JSON.stringify({
        ...result.data,
        isGuest: !session,
      }));
      if (!session) {
        sessionStorage.setItem('jk_guest_lookup', JSON.stringify({
          orderCode: result.data.orderCode,
          email: guestEmail.trim().toLowerCase(),
        }));
      }
      clearCart();
      sessionStorage.removeItem('jk_checkout_idempotency_key');
      router.replace('/pedido-confirmado');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível concluir o pedido.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold text-slate-900">Finalizar Pedido</h1>
      <p className="mb-8 text-slate-600">Atualize a cotação final antes de criar o pedido. Nenhum valor enviado pelo navegador é aceito sem conferência no servidor.</p>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-slate-900">1. Seus dados</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">Nome completo
              <input required type="text" value={guestName} onChange={(event) => setGuestName(event.target.value)} className="mt-1 w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
            <label className="block text-sm font-medium text-slate-700">E-mail
              <input required={!session} type="email" value={guestEmail} onChange={(event) => setGuestEmail(event.target.value)} className="mt-1 w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" placeholder={session ? 'E-mail da conta' : 'voce@exemplo.com'} />
            </label>
            <label className="block text-sm font-medium text-slate-700 md:col-span-2">Telefone / WhatsApp
              <input required type="tel" inputMode="tel" value={formatBrazilianPhone(guestPhone)} onChange={(event) => setGuestPhone(digitsOnly(event.target.value).slice(0, 11))} className="mt-1 w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" placeholder="(35) 99999-9999" />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-slate-900">2. Entrega</h2>
          <div className="mb-6 flex gap-4">
            <label className={`flex-1 cursor-pointer rounded-xl border p-4 ${deliveryType === 'pickup' ? 'border-blue-600 bg-blue-50' : 'hover:bg-slate-50'}`}>
              <input type="radio" name="delivery" checked={deliveryType === 'pickup'} disabled={!checkoutSettings?.pickup_enabled} onChange={() => setDeliveryType('pickup')} className="sr-only" />
              <span className="block font-semibold text-slate-900">Retirada na loja</span><span className="mt-1 block text-sm text-slate-500">Grátis</span>
            </label>
            <label className={`flex-1 cursor-pointer rounded-xl border p-4 ${deliveryType === 'delivery' ? 'border-blue-600 bg-blue-50' : 'hover:bg-slate-50'}`}>
              <input type="radio" name="delivery" checked={deliveryType === 'delivery'} disabled={!checkoutSettings?.delivery_enabled} onChange={() => setDeliveryType('delivery')} className="sr-only" />
              <span className="block font-semibold text-slate-900">Entrega</span><span className="mt-1 block text-sm text-slate-500">{formatCurrency((checkoutSettings?.delivery_fee_cents ?? 0) / 100)}</span>
            </label>
          </div>
          {deliveryType === 'delivery' && <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block text-sm font-medium text-slate-700 md:col-span-2">Rua
              <input required type="text" value={street} onChange={(event) => setStreet(event.target.value)} className="mt-1 w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Número
              <input required type="text" value={number} onChange={(event) => setNumber(event.target.value)} className="mt-1 w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
            <label className="block text-sm font-medium text-slate-700">CEP
              <input required type="text" inputMode="numeric" value={formatBrazilianZipCode(zipCode)} onChange={(event) => setZipCode(digitsOnly(event.target.value).slice(0, 8))} className="mt-1 w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" placeholder="00000-000" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Bairro
              <input required type="text" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} className="mt-1 w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Complemento
              <input type="text" value={complement} onChange={(event) => setComplement(event.target.value)} className="mt-1 w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
            {zipLookupMessage && <p className="flex items-center gap-2 text-sm text-slate-600 md:col-span-3"><MapPin className="h-4 w-4" />{zipLookupMessage}</p>}
          </div>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-slate-900">3. Pagamento</h2>
          <div className="grid grid-cols-3 gap-4">
            {([{ value: 'pix', label: 'PIX' }, { value: 'card', label: 'Cartão' }, { value: 'cash', label: 'Dinheiro' }] as const).map((option) => <label key={option.value} className={`cursor-pointer rounded-xl border p-4 text-center ${paymentMethod === option.value ? 'border-blue-600 bg-blue-50' : 'hover:bg-slate-50'}`}><input type="radio" name="payment" checked={paymentMethod === option.value} onChange={() => setPaymentMethod(option.value)} className="sr-only" /><span className="font-semibold text-slate-900">{option.label}</span></label>)}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold text-slate-900">Cotação final</h2><p className="mt-1 text-sm text-slate-600">Atualize sempre que mudar itens, entrega ou dados do pedido.</p></div>
            <button type="button" onClick={handleRefreshQuote} disabled={isQuoting || checkoutBlocked} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{isQuoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{isQuoting ? 'Atualizando…' : 'Atualizar cotação'}</button>
          </div>

          {quote ? <div className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            {quote.items.map((item, index) => <div key={`${item.name}-${index}`} className="flex justify-between gap-4 text-sm"><div><p className="font-semibold text-slate-900">{item.name} <span className="font-normal text-slate-500">× {item.quantity}</span></p>{item.description && <p className="mt-1 text-slate-600">{item.description}</p>}{item.pageCount > 0 && <p className="mt-1 text-slate-500">{item.pageCount} página(s) por cópia{item.pageCountMethod !== 'exact' ? ' • estimada' : ''}</p>}</div><p className="whitespace-nowrap font-semibold text-slate-900">{formatCurrency(item.totalPriceCents / 100)}</p></div>)}
            <div className="space-y-2 border-t border-slate-200 pt-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><strong>{formatCurrency(quote.subtotalCents / 100)}</strong></div><div className="flex justify-between"><span>Entrega</span><strong>{quote.deliveryFeeCents > 0 ? formatCurrency(quote.deliveryFeeCents / 100) : 'Grátis'}</strong></div><div className="flex justify-between border-t border-slate-200 pt-3 text-lg"><span className="font-bold">Total {quote.hasEstimates ? 'estimado' : 'calculado'}</span><strong>{formatCurrency(quote.totalCents / 100)}</strong></div></div>
            {quote.hasEstimates && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Há contagem de páginas estimada; a equipe confirmará o valor antes do pagamento.</p>}
          </div> : <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Atualize a cotação para visualizar subtotal, entrega e total calculados pelo servidor.</div>}

          {hasFiles && <div className="mb-6 rounded-xl border border-amber-300 bg-amber-100 p-4 text-sm text-amber-900">Os arquivos são conferidos no servidor antes da criação do pedido. Estimativas de páginas serão identificadas na mensagem para a equipe.</div>}
          {checkoutBlocked && <div className="mb-6 flex gap-2 rounded-xl border border-amber-300 bg-amber-100 p-4 text-sm text-amber-900"><AlertCircle className="h-4 w-4 flex-shrink-0" />Volte ao carrinho e conclua a revisão dos itens antes de finalizar.</div>}
          {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

          <button type="submit" disabled={isSubmitting || isQuoting || checkoutBlocked} className="w-full rounded-xl bg-slate-900 py-4 font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70">{isSubmitting ? 'Criando pedido…' : quote ? 'Criar pedido' : 'Atualizar cotação para continuar'}</button>
          <p className="mt-3 text-center text-xs text-slate-500">Depois da confirmação, você poderá abrir o WhatsApp com a mensagem pronta. O pedido não depende de popup.</p>
        </section>
      </form>
    </div>
  );
}
