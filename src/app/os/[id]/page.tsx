import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getAdminSession } from '@/lib/auth/admin';
import { canPerform } from '@/lib/auth/permissions';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/security/admin-input';
import { PrintServiceOrderButton } from '@/components/orders/PrintServiceOrderButton';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ordem de Serviço', robots: { index: false, follow: false } };

const orderStatus: Record<string, string> = {
  created: 'Criado', awaiting_payment: 'Aguardando pagamento', confirmed: 'Confirmado',
  in_production: 'Em produção', ready: 'Pronto', completed: 'Concluído', cancelled: 'Cancelado',
};

const paymentStatus: Record<string, string> = {
  pending_contact: 'Pendente de confirmação', paid: 'Pago', rejected: 'Rejeitado', cancelled: 'Cancelado',
};

const artworkStatus: Record<string, string> = {
  not_required: 'Não aplicável', received: 'Recebida', in_review: 'Em revisão',
  correction_requested: 'Correção solicitada', awaiting_customer_approval: 'Aguardando aprovação do cliente',
  approved_for_production: 'Aprovada para produção',
};

function cents(value: unknown): string {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
}

function fields(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Padrão';
  const pairs = Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => {
      if (typeof item === 'object' && item && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        const label = typeof record.label === 'string' ? record.label : key;
        const selected = record.valueLabel ?? record.value;
        return selected === undefined ? null : `${label}: ${String(selected)}`;
      }
      return `${key}: ${String(item)}`;
    })
    .filter((item): item is string => Boolean(item));
  return pairs.length > 0 ? pairs.join(' · ') : 'Padrão';
}

function catalogVersion(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const serviceSnapshot = (value as Record<string, unknown>).serviceSnapshot;
  if (!serviceSnapshot || typeof serviceSnapshot !== 'object' || Array.isArray(serviceSnapshot)) return null;
  const version = (serviceSnapshot as Record<string, unknown>).catalogVersion;
  return typeof version === 'number' && Number.isSafeInteger(version) && version >= 1 ? `Catálogo v${version}` : null;
}

export default async function OrdemServicoPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!isUuid(params.id)) notFound();
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  if (!canPerform(session.role, 'read_orders')) redirect('/admin/dashboard');

  const supabase = createServiceRoleClient();
  const { data: rawOrder, error } = await supabase
    .from('orders')
    .select(`
      id, order_number, guest_name, guest_phone, guest_email, status, payment_status, payment_method,
      delivery_type, notes, created_at, original_subtotal_cents, original_total_cents, subtotal_cents,
      total_cents, delivery_fee_cents, artwork_status,
      profiles (full_name, phone),
      order_items (id, service_name_snapshot, product_name_snapshot, fields_snapshot, pricing_rule_snapshot, quantity, pages_count, original_total_price_cents, total_price_cents),
      order_files (id, original_name, page_count, page_count_method, mime_type, status, order_item_id, deleted_at),
      order_price_adjustments (id, previous_order_total_cents, new_order_total_cents, reason, created_at, order_version_before, order_version_after, catalog_version)
    `)
    .eq('id', params.id)
    .maybeSingle();
  if (error) throw error;
  if (!rawOrder) notFound();
  const order = rawOrder as any;
  const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
  const customerName = order.guest_name || profile?.full_name || 'Cliente';
  const customerContact = order.guest_phone || profile?.phone || order.guest_email || 'Não informado';
  const activeFiles = (order.order_files || []).filter((file: any) => !file.deleted_at);
  const adjustments = order.order_price_adjustments || [];

  return (
    <main className="mx-auto max-w-5xl bg-white px-4 py-6 text-slate-950 sm:px-8 print:max-w-none print:p-0">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/pedidos/${order.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 hover:text-blue-700"><ArrowLeft className="h-4 w-4" /> Voltar ao pedido</Link>
        <PrintServiceOrderButton />
      </div>

      <article className="border-2 border-slate-950 p-5 text-sm print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6 border-b-2 border-slate-950 pb-4">
          <div><h1 className="text-2xl font-black tracking-wide">JK COPYCENTER</h1><p className="font-semibold">ORDEM DE SERVIÇO PARA PRODUÇÃO</p></div>
          <div className="text-right"><p className="border-2 border-slate-950 px-3 py-1 text-lg font-black">O.S. #{order.order_number}</p><p className="mt-1">Emitida em {new Date(order.created_at).toLocaleString('pt-BR')}</p></div>
        </header>

        <section className="grid grid-cols-1 gap-5 border-b border-slate-950 py-4 sm:grid-cols-2">
          <div><h2 className="border-b border-slate-400 pb-1 font-black uppercase">Cliente</h2><p className="mt-2"><strong>Nome:</strong> {customerName}</p><p><strong>Contato:</strong> {customerContact}</p></div>
          <div><h2 className="border-b border-slate-400 pb-1 font-black uppercase">Operação</h2><p className="mt-2"><strong>Entrega:</strong> {order.delivery_type === 'delivery' ? 'Entrega' : 'Retirada na loja'}</p><p><strong>Pagamento:</strong> {paymentStatus[order.payment_status] || order.payment_status}</p><p><strong>Arte:</strong> {artworkStatus[order.artwork_status] || order.artwork_status}</p><p><strong>Status:</strong> {orderStatus[order.status] || order.status}</p></div>
        </section>

        <section className="py-4"><h2 className="mb-2 border-b-2 border-slate-950 pb-1 font-black uppercase">Itens e especificações</h2>
          <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-xs"><thead><tr className="border-b border-slate-950"><th className="py-2 pr-2">Item</th><th className="py-2 pr-2">Configuração / acabamento</th><th className="py-2 text-center">Pág.</th><th className="py-2 text-center">Qtd.</th><th className="py-2 text-right">Valor vigente</th></tr></thead><tbody>{(order.order_items || []).map((item: any) => <tr key={item.id} className="border-b border-slate-300 align-top"><td className="py-2 pr-2 font-bold">{item.service_name_snapshot || item.product_name_snapshot || 'Item'}{catalogVersion(item.pricing_rule_snapshot) && <span className="mt-0.5 block text-[10px] font-medium text-slate-600">{catalogVersion(item.pricing_rule_snapshot)}</span>}</td><td className="py-2 pr-2">{fields(item.fields_snapshot)}</td><td className="py-2 text-center">{item.pages_count || '—'}</td><td className="py-2 text-center">{item.quantity}</td><td className="py-2 text-right font-bold">{cents(item.total_price_cents)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="border-t border-slate-950 py-4"><h2 className="mb-2 border-b border-slate-400 pb-1 font-black uppercase">Arquivos autorizados</h2>{activeFiles.length === 0 ? <p>Nenhum arquivo vinculado.</p> : <ul className="space-y-1">{activeFiles.map((file: any) => <li key={file.id}>• {file.original_name} — {file.page_count || '—'} pág. ({file.page_count_method})</li>)}</ul>}</section>

        {order.notes && <section className="border-t border-slate-950 py-4"><h2 className="mb-2 border-b border-slate-400 pb-1 font-black uppercase">Observações</h2><p className="whitespace-pre-wrap">{order.notes}</p></section>}

        <section className="border-t border-slate-950 py-4"><h2 className="mb-2 border-b border-slate-400 pb-1 font-black uppercase">Valores comerciais</h2><div className="ml-auto max-w-sm space-y-1"><p className="flex justify-between"><span>Total calculado original</span><strong>{cents(order.original_total_cents)}</strong></p>{adjustments.map((adjustment: any) => <p key={adjustment.id} className="border-t border-slate-200 pt-1 text-xs"><span>v{adjustment.order_version_before} → v{adjustment.order_version_after}{adjustment.catalog_version ? ` · Catálogo v${adjustment.catalog_version}` : ''}: {adjustment.reason}</span><strong className="float-right">{cents(adjustment.previous_order_total_cents)} → {cents(adjustment.new_order_total_cents)}</strong></p>)}<p className="flex justify-between border-t-2 border-slate-950 pt-2 text-base font-black"><span>Total vigente</span><span>{cents(order.total_cents)}</span></p></div></section>

        <footer className="mt-8 grid grid-cols-2 gap-10 text-xs"><div><p className="mb-8 font-bold">Conferência da produção:</p><div className="border-b border-slate-950" /></div><div><p className="mb-8 font-bold">Retirada / entrega:</p><div className="border-b border-slate-950" /></div></footer>
      </article>
      <p className="mt-4 text-center text-xs text-slate-500 print:hidden">A O.S. não expõe links temporários, caminhos internos de arquivo ou dados de pagamento sensíveis.</p>
    </main>
  );
}
