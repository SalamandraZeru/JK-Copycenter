import { NextResponse } from 'next/server';
import { isUuid } from '@/lib/security/admin-input';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ error: 'Requisição não autorizada.' }, { status: 403 });
  }
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_items(service_id, product_id, fields_snapshot, quantity, is_double_sided)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });

  const items = order.order_items.map((item) => ({
    user_id: user.id,
    item_type: item.service_id ? 'service' as const : 'product' as const,
    reference_id: (item.service_id || item.product_id) as string,
    selected_options: item.fields_snapshot || {},
    file_ids: [],
    quantity: item.quantity,
    is_double_sided: item.is_double_sided || false,
    notes: null,
  }));
  if (items.length === 0) return NextResponse.json({ error: 'Pedido sem itens reutilizáveis' }, { status: 409 });

  const { error: insertError } = await supabase.from('cart_items').insert(items);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  return NextResponse.redirect(new URL('/carrinho', request.url));
}
