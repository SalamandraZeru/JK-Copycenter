import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  ShoppingBag, 
  ArrowRight, 
  Clock, 
  Package, 
  Printer, 
  ChevronLeft, 
  ChevronRight,
  Filter
} from 'lucide-react';
import { OrderStatusBadge, OrderStatus } from '@/components/dashboard/OrderStatusBadge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Enums } from '@/types/database';

interface OrderItem {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  payment_method?: string | null;
  payment_status?: string | null;
  delivery_type?: string | null;
}

export default async function PedidosPage(
  props: {
    searchParams: Promise<{ page?: string; status?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const currentPage = parseInt(searchParams.page || '1', 10);
  const statusFilter = searchParams.status || 'all';
  const limit = 8;
  const offset = (currentPage - 1) * limit;

  let orders: OrderItem[] = [];
  let count: number | null = 0;

  let query = supabase
    .from('orders')
    .select('id, order_number, status, total, created_at, payment_method, payment_status, delivery_type', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter as Enums<'order_status'>);
  }

  const { data, count: totalCount } = await query;
  if (data) {
    orders = data.map((item) => ({
      id: String(item.id),
      order_number: String(item.order_number),
      status: (item.status as OrderStatus) || 'created',
      total: Number(item.total) || 0,
      created_at: String(item.created_at),
      payment_method: item.payment_method ? String(item.payment_method) : null,
      payment_status: item.payment_status ? String(item.payment_status) : null,
      delivery_type: item.delivery_type ? String(item.delivery_type) : null,
    }));
  }
  count = totalCount;

  const totalPages = count ? Math.ceil(count / limit) : 1;

  const filterOptions = [
    { label: 'Todos', value: 'all' },
    { label: 'Aguardando pagamento', value: 'awaiting_payment' },
    { label: 'Confirmados', value: 'confirmed' },
    { label: 'Em Produção', value: 'in_production' },
    { label: 'Prontos', value: 'ready' },
    { label: 'Concluídos', value: 'completed' },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-blue-600" />
            Histórico de Pedidos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Acompanhe o status e detalhes dos seus pedidos na JK Copycenter.
          </p>
        </div>
        
        <Link
          href="/grafica"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-600/20 transition-all hover:shadow-lg self-start md:self-auto"
        >
          <Printer className="w-4 h-4" />
          Novo Pedido
        </Link>
      </div>

      {/* Modern Filter Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        <div className="flex items-center gap-1 px-3 text-xs font-semibold text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Filtrar:</span>
        </div>
        {filterOptions.map((opt) => {
          const isActive = statusFilter === opt.value;
          return (
            <Link 
              key={opt.value}
              href={`?status=${opt.value}`}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                isActive 
                  ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/20' 
                  : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {/* Order List */}
      <div className="space-y-3">
        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Nenhum pedido encontrado</h3>
            <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
              {statusFilter !== 'all' 
                ? 'Não há pedidos correspondentes ao filtro selecionado.' 
                : 'Você ainda não realizou nenhum pedido na nossa plataforma gráfica.'}
            </p>
            {statusFilter === 'all' && (
              <Link 
                href="/grafica" 
                className="mt-6 inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-md shadow-blue-600/25 hover:bg-blue-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Fazer meu primeiro pedido
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div 
                key={order.id} 
                className="group bg-white rounded-2xl border border-slate-200/90 hover:border-blue-300 hover:shadow-lg transition-all duration-200 overflow-hidden shadow-xs"
              >
                <Link 
                  href={`/dashboard/pedidos/${order.id}`}
                  className="flex flex-col md:flex-row md:items-center justify-between p-5 gap-4"
                >
                  {/* Left: Info */}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 font-mono font-bold text-xs flex flex-col items-center justify-center flex-shrink-0 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
                      <span className="text-[10px] text-slate-400 uppercase font-sans">Ped.</span>
                      <span>#{order.order_number.slice(-4)}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          Pedido #{order.order_number}
                        </span>
                        <OrderStatusBadge status={order.status} showPulse={true} />
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {format(new Date(order.created_at), "d 'de' MMMM 'de' yyyy, 'às' HH:mm", { locale: ptBR })}
                        </span>
                        {order.delivery_type && (
                          <>
                            <span>&bull;</span>
                            <span className="capitalize">
                              {order.delivery_type === 'pickup' ? 'Retirada na Loja' : 'Entrega em Endereço'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Price & CTA */}
                  <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                        Valor Total
                      </span>
                      <span className="text-lg font-black text-slate-900">
                        R$ {order.total.toFixed(2).replace('.', ',')}
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 text-slate-700 text-xs font-semibold group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <span>Ver Detalhes</span>
                      <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-6 px-6 py-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">
              Mostrando <span className="font-bold text-slate-700">{offset + 1}</span> a <span className="font-bold text-slate-700">{Math.min(offset + limit, count || 0)}</span> de <span className="font-bold text-slate-700">{count}</span> pedidos
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`?status=${statusFilter}&page=${currentPage - 1}`}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold transition-all ${
                  currentPage === 1 
                    ? 'pointer-events-none opacity-40 bg-slate-100 text-slate-400' 
                    : 'bg-white hover:bg-slate-50 text-slate-700 shadow-xs'
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </Link>
              <span className="text-xs text-slate-500 font-semibold px-2">
                {currentPage} de {totalPages}
              </span>
              <Link
                href={`?status=${statusFilter}&page=${currentPage + 1}`}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold transition-all ${
                  currentPage === totalPages 
                    ? 'pointer-events-none opacity-40 bg-slate-100 text-slate-400' 
                    : 'bg-white hover:bg-slate-50 text-slate-700 shadow-xs'
                }`}
              >
                Próxima
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
