'use client';

import React, { useEffect, useState } from 'react';
import { CreditCard, Loader2, Package, Search } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils/format';

interface OrderItem {
  id: string;
  service_name_snapshot: string | null;
  product_name_snapshot: string | null;
  service_description_snapshot: string | null;
  quantity: number;
  pages_count: number;
  unit_price: number;
  total_price: number;
}

interface OrderData {
  id: string;
  order_number: string;
  status: string;
  guest_name: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  payment_status: string;
  delivery_type: string;
  created_at: string;
  order_items: OrderItem[];
}

const statusLabels: Record<string, string> = {
  created: 'Criado',
  awaiting_payment: 'Aguardando confirmação de pagamento',
  confirmed: 'Pagamento confirmado',
  in_production: 'Em Produção',
  ready: 'Pronto',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
};

export default function GuestTrackingPage() {
  const [orderCode, setOrderCode] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('jk_guest_lookup');
    if (!saved) return;
    try {
      const value = JSON.parse(saved) as { orderCode?: string; email?: string };
      if (value.orderCode) setOrderCode(value.orderCode);
      if (value.email) setEmail(value.email);
    } catch {
      sessionStorage.removeItem('jk_guest_lookup');
    }
  }, []);

  const handleValidate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/pedidos/consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderCode, email }),
      });
      const json = (await response.json()) as { success?: boolean; data?: OrderData; error?: string };
      if (!response.ok || !json.success || !json.data) {
        setError(json.error || 'Pedido não encontrado. Confira o código e o e-mail.');
        return;
      }
      setOrder(json.data);
    } catch {
      setError('Não foi possível consultar o pedido agora.');
    } finally {
      setLoading(false);
    }
  };

  if (!order) {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center">
          <Search className="w-12 h-12 text-blue-600 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Acompanhar Pedido</h1>
          <p className="text-slate-600 mb-8">Informe o código recebido ao finalizar a compra e o mesmo e-mail usado no pedido.</p>
          <form onSubmit={handleValidate} className="space-y-4">
            <input required value={orderCode} onChange={(event) => setOrderCode(event.target.value)} placeholder="Código do pedido" autoComplete="off" className="w-full px-4 py-3 border rounded-xl text-slate-900" />
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Seu e-mail" autoComplete="email" className="w-full px-4 py-3 border rounded-xl text-slate-900" />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl disabled:opacity-70 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Buscando...' : 'Consultar pedido'}
            </button>
          </form>
          <Link href="/login" className="block mt-8 text-sm font-medium text-blue-600">Entrar na minha conta</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Pedido #{order.order_number}</h1>
      <p className="text-slate-600 mb-8">Acompanhamento para {order.guest_name || 'Cliente'}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Itens do Pedido</h2>
          {order.order_items.map((item) => (
            <div key={item.id} className="flex justify-between py-3 border-b last:border-0">
              <div><p className="font-semibold">{item.service_name_snapshot || item.product_name_snapshot || 'Item'}</p><p className="text-sm text-slate-500">Qtd: {item.quantity}{item.pages_count > 0 ? ` • ${item.pages_count} págs` : ''}</p></div>
              <span className="font-semibold">{formatCurrency(item.total_price)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200"><h2 className="font-bold mb-4 flex gap-2"><Package className="w-5 h-5" /> Status</h2><span className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-semibold">{statusLabels[order.status] || order.status}</span></div>
          <div className="bg-white rounded-2xl p-6 border border-slate-200"><h2 className="font-bold mb-4 flex gap-2"><CreditCard className="w-5 h-5" /> Resumo</h2><div className="flex justify-between font-bold"><span>Total</span><span>{formatCurrency(order.total)}</span></div></div>
        </div>
      </div>
    </div>
  );
}
