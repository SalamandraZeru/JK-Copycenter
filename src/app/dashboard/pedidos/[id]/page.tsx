import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, MapPin, CreditCard, RefreshCw } from 'lucide-react';
import { OrderStatusBadge } from '@/components/dashboard/OrderStatusBadge';
import { OrderTimeline } from '@/components/dashboard/OrderTimeline';
import { ArtworkApprovalPanel } from '@/components/dashboard/ArtworkApprovalPanel';
import { formatCurrency } from '@/lib/utils/format';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FieldValueItem {
  fieldKey?: string;
  label?: string;
  value?: string | number | boolean;
}

interface DeliveryAddressSnapshot {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  zipCode?: string;
}

function renderFieldsSnapshot(fieldsSnapshot: unknown) {
  if (!fieldsSnapshot) return null;

  if (Array.isArray(fieldsSnapshot)) {
    const list = fieldsSnapshot as FieldValueItem[];
    if (list.length === 0) return null;
    return (
      <div className="mt-1 text-sm text-slate-500 space-y-1">
        {list.map((f, idx) => (
          <div key={f.fieldKey || idx}>
            <span className="font-medium text-slate-700">{f.label || f.fieldKey}:</span> {String(f.value)}
          </div>
        ))}
      </div>
    );
  }

  if (typeof fieldsSnapshot === 'object' && fieldsSnapshot !== null) {
    const entries = Object.entries(fieldsSnapshot as Record<string, unknown>);
    if (entries.length === 0) return null;
    return (
      <div className="mt-1 text-sm text-slate-500 space-y-1">
        {entries.map(([key, val]) => (
          <div key={key}>
            <span className="font-medium text-slate-700">{key}:</span> {String(val)}
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export default async function PedidoDetalhesPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (*),
      order_events (*),
      order_price_adjustments (id, previous_order_total_cents, new_order_total_cents, reason, created_at, order_version_before, order_version_after)
    `)
    .eq('id', params.id)
    .eq('user_id', session.user.id)
    .single();

  if (!order) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-slate-900">Pedido não encontrado</h2>
        <Link href="/dashboard/pedidos" className="mt-4 inline-flex items-center text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para histórico
        </Link>
      </div>
    );
  }

  const addressSnapshot = (order.delivery_address_snapshot && typeof order.delivery_address_snapshot === 'object' && !Array.isArray(order.delivery_address_snapshot))
    ? (order.delivery_address_snapshot as DeliveryAddressSnapshot)
    : null;

  // The assistance contact is centrally configured. Never use a fallback
  // number, which could route customer data to an unintended recipient.
  const configClient = createServiceRoleClient();
  const { data: whatsappSetting } = await configClient
    .from('store_settings')
    .select('value')
    .eq('key', 'whatsapp_number')
    .maybeSingle();
  const whatsappNumber = typeof whatsappSetting?.value === 'string'
    ? whatsappSetting.value.replace(/\D/g, '')
    : '';
  const whatsappMsg = `Olá! Preciso de ajuda com meu pedido #${order.order_number}.`;
  const whatsappLink = /^[0-9]{8,15}$/.test(whatsappNumber)
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMsg)}`
    : null;

  const orderItems = order.order_items || [];
  const orderEvents = order.order_events || [];
  const priceAdjustments = order.order_price_adjustments || [];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/pedidos" className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            Pedido #{order.order_number}
            <OrderStatusBadge status={order.status} />
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Realizado em {format(new Date(order.created_at), "d 'de' MMMM 'de' yyyy, 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Itens do Pedido</h3>
            </div>
            <ul className="divide-y divide-slate-200">
              {orderItems.map((item) => {
                const itemName = item.service_name_snapshot || item.product_name_snapshot || 'Item';
                const unitPrice = item.unit_price ?? 0;
                const totalPrice = item.total_price ?? (unitPrice * item.quantity);
                const pagesCount = item.pages_count ?? 0;

                return (
                  <li key={item.id} className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-slate-900">{itemName}</h4>
                        {item.service_description_snapshot && (
                          <p className="text-xs text-slate-500 mt-0.5">{item.service_description_snapshot}</p>
                        )}
                        {renderFieldsSnapshot(item.fields_snapshot)}
                        <div className="mt-2 text-sm text-slate-500">
                          {item.quantity} {item.quantity === 1 ? 'unidade' : 'unidades'} 
                          {pagesCount > 0 ? ` • ${pagesCount} págs` : ''}
                          {unitPrice > 0 ? ` • R$ ${unitPrice.toFixed(2).replace('.', ',')} un.` : ''}
                        </div>
                      </div>
                      <div className="text-right font-semibold text-slate-900">
                        R$ {totalPrice.toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 text-right">
              <div className="text-sm text-slate-500 mb-1">
                Taxa de Entrega: R$ {(order.delivery_fee ?? 0).toFixed(2).replace('.', ',')}
              </div>
              <div className="text-lg font-bold text-slate-900">
                Total: R$ {(order.total ?? 0).toFixed(2).replace('.', ',')}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-6">Linha do Tempo</h3>
            <OrderTimeline events={orderEvents} />
          </div>

          {priceAdjustments.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900">Ajustes de valor</h3>
              <p className="mt-1 text-sm text-slate-600">Base calculada: <strong>{formatCurrency(Number(order.original_total_cents ?? order.total_cents) / 100)}</strong> · Total vigente: <strong>{formatCurrency(Number(order.total_cents ?? 0) / 100)}</strong></p>
              <div className="mt-4 space-y-3">
                {priceAdjustments.map((adjustment) => (
                  <div key={adjustment.id} className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-slate-800">
                    <p className="font-semibold">{formatCurrency(Number(adjustment.previous_order_total_cents) / 100)} → {formatCurrency(Number(adjustment.new_order_total_cents) / 100)}</p>
                    <p className="mt-1">{adjustment.reason}</p>
                    <p className="mt-1 text-xs text-slate-600">{format(new Date(adjustment.created_at), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })} · atualização comercial v{adjustment.order_version_before} → v{adjustment.order_version_after}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ArtworkApprovalPanel orderId={order.id} />
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-slate-400" /> Pagamento
            </h3>
            <div className="text-sm">
              <p className="text-slate-600 mb-1">
                Método: <span className="font-medium text-slate-900 capitalize">{order.payment_method}</span>
              </p>
              <p className="text-slate-600">
                Status:{' '}
                <span className={`font-medium ${order.payment_status === 'paid' ? 'text-green-600' : order.payment_status === 'pending_contact' ? 'text-yellow-600' : 'text-red-600'}`}>
                  {order.payment_status === 'paid' ? 'Pago' : order.payment_status === 'pending_contact' ? 'Pendente de confirmação' : order.payment_status === 'rejected' ? 'Rejeitado' : 'Cancelado'}
                </span>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-slate-400" /> Entrega
            </h3>
            <div className="text-sm text-slate-600">
              {order.delivery_type === 'pickup' ? (
                <p className="font-medium">Retirada na loja</p>
              ) : (
                <>
                  <p className="font-medium text-slate-900 mb-1">{order.guest_name || 'Cliente'}</p>
                  <p>
                    {addressSnapshot?.street
                      ? `${addressSnapshot.street}, ${addressSnapshot.number || 'S/N'}${addressSnapshot.complement ? ` - ${addressSnapshot.complement}` : ''}`
                      : 'Endereço não disponível'}
                  </p>
                  {addressSnapshot?.neighborhood && (
                    <p>{addressSnapshot.neighborhood} - {addressSnapshot.city || ''}/{addressSnapshot.state || ''}</p>
                  )}
                  {(addressSnapshot?.zip_code || addressSnapshot?.zipCode) && (
                    <p>CEP: {addressSnapshot.zip_code || addressSnapshot.zipCode}</p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {whatsappLink && <a 
              href={whatsappLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full bg-[#25D366] text-white px-4 py-2.5 rounded-md font-medium hover:bg-[#22bf5b] transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" /> Falar no WhatsApp
            </a>}

            <form action={`/api/dashboard/pedidos/${order.id}/repetir`} method="POST">
              <button 
                type="submit"
                className="w-full bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-md font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" /> Repetir Pedido
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
