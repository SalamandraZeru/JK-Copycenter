'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Loader2, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import type { CheckoutResult } from '@/types/checkout';

type ConfirmationData = CheckoutResult & { isGuest: boolean };

export default function PedidoConfirmadoPage() {
  const [order, setOrder] = useState<ConfirmationData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('jk_checkout_confirmation');
    if (saved) {
      try {
        setOrder(JSON.parse(saved) as ConfirmationData);
      } catch {
        sessionStorage.removeItem('jk_checkout_confirmation');
      }
    }
    setLoaded(true);
  }, []);

  if (!loaded) {
    return <div className="max-w-2xl mx-auto px-4 py-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" /></div>;
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-3xl p-10 border border-slate-200">
          <p className="text-slate-700 font-semibold mb-6">Os dados desta confirmação não estão mais disponíveis neste navegador.</p>
          <Link href="/pedido" className="bg-blue-600 text-white font-bold py-3 px-6 rounded-xl">Consultar pedido</Link>
        </div>
      </div>
    );
  }

  const copyValue = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="bg-white rounded-3xl p-10 border border-slate-200 shadow-sm flex flex-col items-center">
        <CheckCircle2 className="w-20 h-20 text-green-600 mb-6" />
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Pedido Recebido!</h1>
        <p className="text-slate-600 mb-8">Seu pedido foi registrado. O pagamento permanece pendente de confirmação pela equipe.</p>

        <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
          <p className="text-sm text-slate-500 uppercase font-semibold">Número do Pedido</p>
          <p className="text-3xl font-extrabold text-slate-900">#{order.orderNumber}</p>
        </div>

        {order.isGuest && (
          <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6 text-left">
            <p className="font-bold text-slate-900 mb-2">Código para acompanhamento</p>
            <div className="flex items-center gap-2">
              <code className="text-sm break-all flex-1">{order.orderCode}</code>
              <button type="button" onClick={() => copyValue(order.orderCode)} className="p-2 text-blue-700" aria-label="Copiar código"><Copy className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-600 mt-2">Guarde este código. A consulta também exigirá o e-mail do pedido.</p>
          </div>
        )}

        <div className="w-full space-y-3">
          <a href={order.whatsappUrl} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-4 rounded-xl"><MessageCircle className="w-5 h-5" />Abrir WhatsApp novamente</a>
          <Link href={order.isGuest ? '/pedido' : `/dashboard/pedidos/${order.orderId}`} className="w-full block bg-slate-900 text-white font-bold py-4 rounded-xl">Acompanhar Pedido</Link>
          <Link href="/grafica" className="w-full block bg-white border border-slate-200 text-slate-700 font-bold py-4 rounded-xl">Novo Pedido</Link>
        </div>
      </div>
    </div>
  );
}
