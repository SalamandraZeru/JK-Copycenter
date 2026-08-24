'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils/format';
import { Search, Filter, Loader2, Eye, Package, CheckCircle2, Clock } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-blue-100 text-blue-800 border-blue-200',
  awaiting_payment: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  in_production: 'bg-amber-100 text-amber-800 border-amber-200',
  ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  completed: 'bg-slate-100 text-slate-700 border-slate-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  created: 'Criado',
  awaiting_payment: 'Aguardando pagamento',
  confirmed: 'Pagamento confirmado',
  in_production: 'Em Produção',
  ready: 'Pronto p/ Retirada',
  completed: 'Entregue / Concluído',
  cancelled: 'Cancelado',
};

export default function PedidosPage() {
  const [status, setStatus] = useState('');
  const [payment, setPayment] = useState('');
  const [query, setQuery] = useState('');
  
  const url = `/api/admin/pedidos?status=${status}&payment=${payment}&q=${query}`;
  const { data: rawOrders, error, isLoading } = useSWR(url, fetcher);

  const orders = Array.isArray(rawOrders) ? rawOrders : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-serif">Gestão de Pedidos</h1>
          <p className="text-sm text-slate-600 font-medium">Acompanhe todos os pedidos recebidos e gerencie status de entrega.</p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-500" />
          <input 
            type="text" 
            placeholder="Buscar por número do pedido ou cliente..."
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium placeholder:text-slate-500 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        
        <div className="flex gap-3">
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-3.5 text-slate-500 pointer-events-none" />
            <select 
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
            >
              <option value="">Todos Status</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          
          <select 
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
          >
            <option value="">Todo Pagamento</option>
            <option value="pix">PIX</option>
            <option value="card">Cartão</option>
            <option value="cash">Dinheiro</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center p-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="p-16 text-center text-red-600 font-medium">
            Erro ao carregar lista de pedidos.
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="font-bold text-slate-700">Nenhum pedido encontrado.</p>
            <p className="text-xs text-slate-400 mt-1">Novos pedidos feitos na loja aparecerão automaticamente aqui.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Pedido</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-blue-600 font-mono">#{order.order_number}</td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{order.customer_name}</p>
                      <p className="text-xs text-slate-500 capitalize">{order.delivery_type === 'delivery' ? 'Entrega' : 'Retirada na loja'}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-700 text-sm font-medium">
                      {new Date(order.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {formatCurrency(order.total)}
                      <p className="text-xs text-slate-500 font-medium capitalize">{order.payment_method}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${STATUS_COLORS[order.status] || 'bg-slate-100 text-slate-700'}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/admin/pedidos/${order.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg text-xs font-bold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
