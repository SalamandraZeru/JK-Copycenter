'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Loader2, ArrowRight, CheckCircle2, Clock, PlayCircle, Eye, Package } from 'lucide-react';
import { productionNextStatus } from '@/lib/orders/operation';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const COLUMNS = [
  { id: 'confirmed', title: 'Pagamentos Confirmados', color: 'bg-blue-600 text-white', badge: 'bg-blue-100 text-blue-800' },
  { id: 'in_production', title: 'Em Produção', color: 'bg-amber-600 text-white', badge: 'bg-amber-100 text-amber-800' },
  { id: 'ready', title: 'Pronto p/ Retirada', color: 'bg-emerald-600 text-white', badge: 'bg-emerald-100 text-emerald-800' },
];

export default function ProducaoPage() {
  const { data: rawOrders, error, isLoading, mutate } = useSWR('/api/admin/producao', fetcher);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const orders = Array.isArray(rawOrders) ? rawOrders : [];

  const handleUpdateStatus = async (orderId: string, nextStatus: 'in_production' | 'ready' | 'completed') => {
    setIsUpdating(orderId);
    try {
      const res = await fetch(`/api/admin/pedidos/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, notes: 'Transição registrada pela fila de produção.', idempotencyKey: crypto.randomUUID() }),
      });

      if (!res.ok) throw new Error('Erro ao atualizar status');
      await mutate();
    } catch {
      alert('Erro ao atualizar status do pedido na produção.');
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-serif">Fila de Produção (Kanban)</h1>
        <p className="text-sm text-slate-600 font-medium">Acompanhe e avance o fluxo operacional de impressão e acabamento.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="p-16 text-center text-red-600 font-medium bg-white rounded-2xl border border-slate-200">
          Erro ao carregar fila de produção.
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-w-[850px] items-start">
            {COLUMNS.map(column => {
              const columnOrders = orders.filter((o: any) => o.status === column.id);

              return (
                <div key={column.id} className="flex flex-col bg-slate-100/90 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Column Header */}
                  <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center">
                    <h3 className={`font-bold px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider ${column.badge}`}>
                      {column.title}
                    </h3>
                    <span className="bg-slate-200 text-slate-800 text-xs font-extrabold px-2.5 py-1 rounded-full">
                      {columnOrders.length}
                    </span>
                  </div>
                  
                  {/* Orders List */}
                  <div className="p-4 space-y-4 min-h-[450px] max-h-[700px] overflow-y-auto">
                    {columnOrders.length === 0 ? (
                      <div className="py-16 text-center text-slate-400 text-xs font-semibold">
                        Nenhum pedido nesta etapa
                      </div>
                    ) : (
                      columnOrders.map((order: any) => (
                        <div key={order.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col hover:border-blue-400 hover:shadow-md transition-all">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-mono text-sm font-extrabold text-blue-600">
                              #{order.order_number}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <p className="font-bold text-slate-900 text-sm mb-3">Dados técnicos do pedido</p>

                          {order.payment_status !== 'paid' && (
                            <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-xs font-bold text-rose-800">
                              Produção bloqueada: pagamento ainda não confirmado.
                            </p>
                          )}

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-700 space-y-1 mb-4">
                            {order.order_items?.map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between font-medium">
                                <span className="truncate max-w-[160px] text-slate-900">{item.service_name_snapshot}</span>
                                <span className="font-bold text-slate-600">x{item.quantity}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            <Link 
                              href={`/admin/pedidos/${order.id}`}
                              className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> Ver arquivos
                            </Link>

                            {column.id === 'confirmed' && productionNextStatus(order.status, order.payment_status) === 'in_production' && (
                              <button
                                onClick={() => handleUpdateStatus(order.id, 'in_production')}
                                disabled={isUpdating === order.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                              >
                                <PlayCircle className="w-3.5 h-3.5" /> Produzir
                              </button>
                            )}

                            {column.id === 'in_production' && productionNextStatus(order.status, order.payment_status) === 'ready' && (
                              <button
                                onClick={() => handleUpdateStatus(order.id, 'ready')}
                                disabled={isUpdating === order.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                              </button>
                            )}

                            {column.id === 'ready' && productionNextStatus(order.status, order.payment_status) === 'completed' && (
                              <button
                                onClick={() => handleUpdateStatus(order.id, 'completed')}
                                disabled={isUpdating === order.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-sm"
                              >
                                <Package className="w-3.5 h-3.5" /> Entregar
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
