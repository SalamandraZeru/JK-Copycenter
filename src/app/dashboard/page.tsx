import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  ShoppingBag, 
  ArrowRight, 
  MapPin, 
  FileText, 
  Sparkles,
  Clock,
  Printer,
  ChevronRight,
  PackageCheck
} from 'lucide-react';
import { OrderStatusBadge, OrderStatus } from '@/components/dashboard/OrderStatusBadge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrderItemSummary {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  created_at: string;
}

interface UserAddress {
  label: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
}

export default async function DashboardOverview() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 1. Fetch profile
  let profile: { full_name: string | null } = { full_name: null };
  let recentOrders: OrderItemSummary[] = [];
  let defaultAddress: UserAddress | null = null;

  let activeOrdersCount = 0;
  let readyOrdersCount = 0;

  const { data: userProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    if (userProfile) profile = userProfile;

    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, order_number, status, total, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (ordersData) {
      recentOrders = ordersData.map((o) => ({
        id: String(o.id),
        order_number: String(o.order_number),
        status: (o.status as OrderStatus) || 'created',
        total: Number(o.total) || 0,
        created_at: String(o.created_at),
      }));

      activeOrdersCount = recentOrders.filter(
        (o) => o.status === 'awaiting_payment' || o.status === 'confirmed' || o.status === 'in_production'
      ).length;
      readyOrdersCount = recentOrders.filter((o) => o.status === 'ready').length;
    }

    const { data: addressData } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .single();

  defaultAddress = addressData ? (addressData as unknown as UserAddress) : null;

  const firstName = profile?.full_name?.split(' ')[0] || 'Cliente';
  const currentDateFormatted = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl shadow-slate-900/10 border border-slate-800">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-20 -mb-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-medium text-blue-200 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span className="capitalize">{currentDateFormatted}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Olá, {firstName}!
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-slate-300 max-w-xl">
              Bem-vindo ao seu portal exclusivo JK Copycenter. Acompanhe seus pedidos em tempo real ou inicie novas impressões.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeOrdersCount > 0 && (
              <div className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <div className="text-left">
                  <p className="text-[11px] text-slate-300 uppercase tracking-wider font-semibold">Em Produção</p>
                  <p className="text-base font-bold text-white leading-none mt-0.5">{activeOrdersCount} {activeOrdersCount === 1 ? 'pedido' : 'pedidos'}</p>
                </div>
              </div>
            )}

            {readyOrdersCount > 0 && (
              <div className="px-4 py-2.5 rounded-xl bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <div className="text-left">
                  <p className="text-[11px] text-emerald-200 uppercase tracking-wider font-semibold">Pronto p/ Retirada</p>
                  <p className="text-base font-bold text-white leading-none mt-0.5">{readyOrdersCount} {readyOrdersCount === 1 ? 'pedido' : 'pedidos'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Shortcut Cards with Microinteractions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            Atalhos Rápidos
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Fazer Pedido */}
          <Link
            href="/grafica"
            className="group relative overflow-hidden bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:border-blue-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-100/50 to-transparent rounded-bl-full pointer-events-none transition-all duration-300 group-hover:scale-110" />
            <div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 mb-4 group-hover:scale-110 transition-transform duration-300">
                <Printer className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                Novo Pedido Gráfico
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
                Apostilas, cartões de visita, banners, adesivos e serviços de cópias com cálculo instantâneo de valores.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600 group-hover:text-blue-700">
              <span>Abrir Catálogo de Serviços</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform" />
            </div>
          </Link>

          {/* Card 2: Meus Arquivos */}
          <Link
            href="/dashboard/arquivos"
            className="group relative overflow-hidden bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:border-amber-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-100/50 to-transparent rounded-bl-full pointer-events-none transition-all duration-300 group-hover:scale-110" />
            <div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/25 mb-4 group-hover:scale-110 transition-transform duration-300">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                Meus Arquivos & PDFs
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">
                Acesse arquivos já enviados e reutilize-os rapidamente para novas impressões sem precisar reenviar.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-amber-700 group-hover:text-amber-800">
              <span>Ver Meus Arquivos Salvos</span>
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Endereço Padrão */}
          <div className="group relative overflow-hidden bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:border-emerald-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between sm:col-span-2 lg:col-span-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-100/50 to-transparent rounded-bl-full pointer-events-none transition-all duration-300 group-hover:scale-110" />
            <div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 mb-4 group-hover:scale-110 transition-transform duration-300">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Endereço Principal
              </h3>
              {defaultAddress ? (
                <div className="mt-2 text-xs sm:text-sm text-slate-600 space-y-0.5">
                  <p className="font-semibold text-slate-900">{defaultAddress.label}</p>
                  <p>{defaultAddress.street}, {defaultAddress.number} {defaultAddress.complement}</p>
                  <p>{defaultAddress.neighborhood} - {defaultAddress.city}/{defaultAddress.state}</p>
                  <p className="text-slate-400 font-mono text-xs">CEP: {defaultAddress.zip_code}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs sm:text-sm text-slate-500">
                  Você ainda não cadastrou um endereço padrão para entrega rápida.
                </p>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <Link
                href="/dashboard/enderecos"
                className="flex items-center justify-between text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                <span>Gerenciar Endereços</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Pedidos Recentes Section with Pulsing Status and Premium Visual */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-white to-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Últimos Pedidos</h3>
              <p className="text-xs text-slate-500">Acompanhe as atualizações de produção</p>
            </div>
          </div>
          <Link
            href="/dashboard/pedidos"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            <span>Ver histórico completo</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <PackageCheck className="w-7 h-7" />
            </div>
            <h4 className="text-base font-semibold text-slate-900">Nenhum pedido realizado ainda</h4>
            <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto mt-1.5">
              Faça seu primeiro pedido no nosso catálogo gráfico online e acompanhe todas as etapas por aqui.
            </p>
            <Link
              href="/grafica"
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Fazer Primeiro Pedido
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentOrders.map((order) => (
              <li key={order.id} className="group hover:bg-blue-50/30 transition-colors duration-150">
                <Link
                  href={`/dashboard/pedidos/${order.id}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 gap-3 sm:gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-mono font-bold text-xs flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                      #{order.order_number.slice(-4)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <p className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                          Pedido #{order.order_number}
                        </p>
                        <OrderStatusBadge status={order.status} showPulse={true} />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{format(new Date(order.created_at), "d 'de' MMMM, yyyy", { locale: ptBR })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 pl-13 sm:pl-0">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 block">Total</span>
                      <span className="text-sm sm:text-base font-extrabold text-slate-900">
                        R$ {order.total.toFixed(2).replace('.', ',')}
                      </span>
                    </div>

                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:translate-x-1">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
