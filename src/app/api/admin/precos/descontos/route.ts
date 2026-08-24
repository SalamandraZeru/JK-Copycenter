import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { logAdminAction } from '@/lib/auth/admin';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';

export const dynamic = 'force-dynamic';

const discountSchema = z.object({
  service_id: z.string().uuid(),
  min_quantity: z.coerce.number().int().min(1).max(100_000_000),
  max_quantity: z.union([z.coerce.number().int().min(1).max(100_000_000), z.literal(''), z.null()]).optional(),
  discount_percent: z.coerce.number().min(0).max(100),
  is_active: z.boolean().optional(),
}).strict().refine((value) => value.max_quantity === undefined || value.max_quantity === '' || value.max_quantity === null || value.max_quantity >= value.min_quantity, {
  path: ['max_quantity'],
  message: 'Quantidade máxima deve ser maior ou igual à mínima.',
});

export async function GET(request: Request) {
  try {
    const auth = await requireApiAdminPermission('manage_pricing');
    if (!auth.success) return auth.errorResponse;

    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('service_id');

    const supabase = createServiceRoleClient();
    let query = supabase
      .from('pricing_discounts')
      .select('*, services (id, name)')
      .order('min_quantity', { ascending: true });

    if (serviceId) {
      query = query.eq('service_id', serviceId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiAdminPermission('manage_pricing');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    const parsed = await parseAdminJson(request, discountSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const { data, error } = await supabase
      .from('pricing_discounts')
      .insert({
        service_id: body.service_id,
        min_quantity: Number(body.min_quantity) || 1,
        max_quantity: body.max_quantity ? Number(body.max_quantity) : null,
        discount_percent: Number(body.discount_percent) || 0,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) throw error;

    await logAdminAction(supabase, auth.session.id, 'create_pricing_discount', 'pricing_discounts', data.id, {
      service_id: data.service_id,
      min_quantity: data.min_quantity,
      discount_percent: data.discount_percent,
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao criar desconto';
    return NextResponse.json({ error: message }, { status: message.includes('AMBIGUOUS_PRICING_DISCOUNT') ? 409 : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireApiAdminPermission('manage_pricing');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!isUuid(id)) {
      return NextResponse.json({ error: 'ID não informado' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('pricing_discounts')
      .update({ is_active: false })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Desconto não encontrado' }, { status: 404 });

    await logAdminAction(supabase, auth.session.id, 'deactivate_pricing_discount', 'pricing_discounts', id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao inativar desconto';
    return NextResponse.json({ error: message }, { status: message.includes('AMBIGUOUS_PRICING_DISCOUNT') ? 409 : 500 });
  }
}
