'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { useCartStore } from '@/lib/cart/store';
import { createClient } from '@/lib/supabase/client';
import type { DeliveryType, PaymentMethod } from '@/types';
import type { CheckoutPayload, CheckoutResult } from '@/types/checkout';
import { formatCurrency } from '@/lib/utils/format';

interface CheckoutSettings {
  delivery_fee_cents: number;
  delivery_city: string;
  delivery_state: string;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [checkoutSettings, setCheckoutSettings] = useState<CheckoutSettings | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  
  // Form States
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
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data }) => {
      const sess = data.session;
      setSession(sess);
      if (sess?.user) {
        if (sess.user.email) {
          setGuestEmail(sess.user.email);
        }
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', sess.user.id)
            .single();

          if (profile) {
            if (profile.full_name) setGuestName(profile.full_name);
            if (profile.phone) setGuestPhone(profile.phone);
          }
        } catch {
          // ignore profile fetch error
        }
      }
    });
  }, []);

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

  if (!mounted) return null;

  if (items.length === 0) return null;

  const hasFiles = items.some((item) => item.fileIds.length > 0);
  const requiresFileReupload = items.some((item) => item.requiresFileReupload);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    let whatsappWindow: Window | null = null;

    try {
      if (requiresFileReupload) {
        throw new Error('Um ou mais anexos não pertencem mais a esta sessão. Volte ao carrinho, reconfigure o serviço e envie os arquivos novamente.');
      }
      if (!checkoutSettings) throw new Error('Configuração de entrega indisponível.');
      if (deliveryType === 'delivery' && (
        !checkoutSettings.delivery_enabled
        || !checkoutSettings.delivery_city
        || !/^[A-Z]{2}$/.test(checkoutSettings.delivery_state)
      )) {
        throw new Error('Entrega temporariamente indisponível por configuração incompleta.');
      }
      if (deliveryType === 'pickup' && !checkoutSettings.pickup_enabled) {
        throw new Error('Retirada temporariamente indisponível.');
      }

      const storedIdempotencyKey = sessionStorage.getItem('jk_checkout_idempotency_key');
      const idempotencyKey = idempotencyKeyRef.current
        || (storedIdempotencyKey && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(storedIdempotencyKey)
          ? storedIdempotencyKey
          : crypto.randomUUID());
      idempotencyKeyRef.current = idempotencyKey;
      sessionStorage.setItem('jk_checkout_idempotency_key', idempotencyKey);

      const payload: CheckoutPayload = {
        idempotencyKey,
        items: items.map((i) => ({
          ...(i.serviceId && i.serviceId.trim() !== '' ? { serviceId: i.serviceId.trim() } : {}),
          ...(i.productId && i.productId.trim() !== '' ? { productId: i.productId.trim() } : {}),
          attributeIds: i.attributeIds || [],
          fieldValues: i.fieldValues || [],
          pageCount: i.pageCount ?? 1,
          isFrontAndBack: Boolean(i.isFrontAndBack),
          quantity: i.quantity,
          fileIds: i.fileIds || [],
        })),
        deliveryType,
        paymentMethod,
        ...(deliveryType === 'delivery' && {
          deliveryAddress: {
            street,
            number,
            complement: complement.trim() || undefined,
            neighborhood,
            city: checkoutSettings.delivery_city,
            state: checkoutSettings.delivery_state,
            zipCode,
          },
        }),
        customerName: guestName.trim() || undefined,
        customerPhone: guestPhone.trim() || undefined,
        guestEmail: guestEmail.trim().toLowerCase() || undefined,
      };

      // Reserva a janela no gesto do usuário, mas só a navega para wa.me após
      // receber a confirmação de commit do servidor.
      whatsappWindow = window.open('', 'jk-order-whatsapp');
      if (whatsappWindow) whatsappWindow.opener = null;

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const result: unknown = await res.json();
      
      if (!res.ok) {
        let errMsg = 'Erro ao processar pedido';
        if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') {
          errMsg = result.error;
        }
        throw new Error(errMsg);
      }

      const successData = result as { success: boolean; data?: CheckoutResult };
      if (!successData.success || !successData.data) {
        throw new Error('Resposta inválida ao concluir o pedido.');
      }

      if (whatsappWindow && !whatsappWindow.closed) {
        whatsappWindow.location.replace(successData.data.whatsappUrl);
      } else {
        window.location.assign(successData.data.whatsappUrl);
      }

      sessionStorage.setItem('jk_checkout_confirmation', JSON.stringify({
        ...successData.data,
        isGuest: !session,
      }));
      if (!session) {
        sessionStorage.setItem('jk_guest_lookup', JSON.stringify({
          orderCode: successData.data.orderCode,
          email: guestEmail.trim().toLowerCase(),
        }));
      }
      clearCart();
      sessionStorage.removeItem('jk_checkout_idempotency_key');
      router.push('/pedido-confirmado');
    } catch (err: unknown) {
      whatsappWindow?.close();
      const message = err instanceof Error ? err.message : 'Erro ao processar pedido';
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Finalizar Pedido</h1>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4">1. Seus Dados</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
              <input
                required
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder={session ? undefined : 'opcional se informar WhatsApp'}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Telefone / WhatsApp</label>
              <input
                required
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="(35) 99999-9999"
              />
            </div>
          </div>
        </section>

        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4">2. Entrega</h2>
          <div className="flex gap-4 mb-6">
            <label className={`flex-1 p-4 border rounded-xl cursor-pointer ${deliveryType === 'pickup' ? 'border-blue-600 bg-blue-50' : 'hover:bg-slate-50'}`}>
              <input type="radio" name="delivery" value="pickup" checked={deliveryType === 'pickup'} disabled={!checkoutSettings?.pickup_enabled} onChange={() => setDeliveryType('pickup')} className="sr-only" />
              <div className="font-semibold text-slate-900">Retirada na Loja</div>
              <div className="text-sm text-slate-500 mt-1">Grátis</div>
            </label>
            <label className={`flex-1 p-4 border rounded-xl cursor-pointer ${deliveryType === 'delivery' ? 'border-blue-600 bg-blue-50' : 'hover:bg-slate-50'}`}>
              <input type="radio" name="delivery" value="delivery" checked={deliveryType === 'delivery'} disabled={!checkoutSettings?.delivery_enabled} onChange={() => setDeliveryType('delivery')} className="sr-only" />
              <div className="font-semibold text-slate-900">Entrega</div>
              <div className="text-sm text-slate-500 mt-1">{formatCurrency((checkoutSettings?.delivery_fee_cents ?? 0) / 100)}</div>
            </label>
          </div>

          {deliveryType === 'delivery' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Rua</label>
                <input required type="text" value={street} onChange={(e) => setStreet(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Número</label>
                <input required type="text" value={number} onChange={(e) => setNumber(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
                <input required type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Bairro</label>
                <input required type="text" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Complemento</label>
                <input type="text" value={complement} onChange={(e) => setComplement(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
          )}
        </section>

        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4">3. Pagamento</h2>
          <div className="grid grid-cols-3 gap-4">
            <label className={`p-4 border rounded-xl cursor-pointer text-center ${paymentMethod === 'pix' ? 'border-blue-600 bg-blue-50' : 'hover:bg-slate-50'}`}>
              <input type="radio" name="payment" value="pix" checked={paymentMethod === 'pix'} onChange={() => setPaymentMethod('pix')} className="sr-only" />
              <div className="font-semibold text-slate-900">PIX</div>
            </label>
            <label className={`p-4 border rounded-xl cursor-pointer text-center ${paymentMethod === 'card' ? 'border-blue-600 bg-blue-50' : 'hover:bg-slate-50'}`}>
              <input type="radio" name="payment" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} className="sr-only" />
              <div className="font-semibold text-slate-900">Cartão</div>
            </label>
            <label className={`p-4 border rounded-xl cursor-pointer text-center ${paymentMethod === 'cash' ? 'border-blue-600 bg-blue-50' : 'hover:bg-slate-50'}`}>
              <input type="radio" name="payment" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} className="sr-only" />
              <div className="font-semibold text-slate-900">Dinheiro</div>
            </label>
          </div>
        </section>

        <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Resumo Final</h2>
          <p className="text-sm text-slate-600 mb-5">O pagamento fica pendente de confirmação pela equipe. Fechar o WhatsApp não aprova nem cria outro pedido.</p>
          
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-medium text-slate-900">Recalculado no servidor</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Entrega</span>
              <span className="font-medium text-slate-900">Definida pelo servidor</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200 pt-3">
              <span className="text-lg font-bold text-slate-900">Estimativa no carrinho</span>
              <span className="text-right text-sm font-medium text-blue-700">O total final será confirmado após o commit</span>
            </div>
          </div>

          {hasFiles && (
            <div className="bg-amber-100 border border-amber-300 text-amber-900 p-4 rounded-xl text-sm mb-6 flex items-start gap-3">
              <span className="text-2xl leading-none">⚠️</span>
              <div>
                <strong>Atenção:</strong> O servidor confere os arquivos e recalcula o valor antes de criar o pedido. Se houver estimativa de páginas, ela será informada no WhatsApp para confirmação da equipe.
              </div>
            </div>
          )}

          {requiresFileReupload && (
            <div className="bg-amber-100 border border-amber-300 text-amber-900 p-4 rounded-xl text-sm mb-6">
              Reconfigure os itens no carrinho e envie os arquivos novamente antes de finalizar.
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || requiresFileReupload}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Criando pedido...' : 'Criar pedido e abrir WhatsApp'}
          </button>
        </section>
      </form>
    </div>
  );
}
