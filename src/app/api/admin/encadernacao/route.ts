import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { logAdminAction } from '@/lib/auth/admin';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';
import { reaisToCents } from '@/lib/pricing/money';

export const dynamic = 'force-dynamic';

const tierFields = {
  service_id: z.string().uuid(),
  min_pages: z.coerce.number().int().min(1).max(1_000_000),
  max_pages: z.union([z.coerce.number().int().min(1).max(1_000_000), z.null()]),
  price: z.coerce.number().min(0).max(1_000_000),
  is_active: z.boolean().optional(),
};

function validateTierRange(tier: { min_pages: number; max_pages: number | null }, context: z.RefinementCtx): void {
  if (tier.max_pages !== null && tier.max_pages < tier.min_pages) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['max_pages'], message: 'A página final deve ser maior ou igual à inicial.' });
  }
}

const createTierSchema = z.object(tierFields).strict().superRefine(validateTierRange);
const updateTierSchema = z.object({ ...tierFields, id: z.string().uuid() }).strict().superRefine(validateTierRange);

function conflictMessage(error: { message?: string }): string {
  if (error.message?.includes('service_binding_price_tiers_no_overlap')) {
    return 'Esta faixa sobrepõe outra faixa ativa do mesmo serviço.';
  }
  return error.message || 'Não foi possível salvar a faixa de encadernação.';
}

async function requireActiveService(serviceId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from('services')
    .select('id')
    .eq('id', serviceId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();
  return Boolean(data);
}

export async function GET(): Promise<NextResponse> {
  const auth = await requireApiAdminPermission('manage_pricing');
  if (!auth.success) return auth.errorResponse;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('service_binding_price_tiers')
    .select('*, services(id, name)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireApiAdminPermission('manage_pricing');
  if (!auth.success) return auth.errorResponse;
  const parsed = await parseAdminJson(request, createTierSchema);
  if (!parsed.success) return parsed.errorResponse;
  const body = parsed.data;
  if (!await requireActiveService(body.service_id)) {
    return NextResponse.json({ error: 'Serviço inexistente ou inativo.' }, { status: 409 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('service_binding_price_tiers')
    .insert({
      service_id: body.service_id,
      min_pages: body.min_pages,
      max_pages: body.max_pages,
      price_cents: reaisToCents(body.price),
      is_active: body.is_active ?? true,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: conflictMessage(error) }, { status: error.message.includes('no_overlap') ? 409 : 500 });

  await logAdminAction(supabase, auth.session.id, 'create_binding_price_tier', 'service_binding_price_tiers', data.id, {
    service_id: data.service_id,
    min_pages: data.min_pages,
    max_pages: data.max_pages,
    price_cents: data.price_cents,
  });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const auth = await requireApiAdminPermission('manage_pricing');
  if (!auth.success) return auth.errorResponse;
  const parsed = await parseAdminJson(request, updateTierSchema);
  if (!parsed.success) return parsed.errorResponse;
  const body = parsed.data;
  if (!await requireActiveService(body.service_id)) {
    return NextResponse.json({ error: 'Serviço inexistente ou inativo.' }, { status: 409 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('service_binding_price_tiers')
    .update({
      service_id: body.service_id,
      min_pages: body.min_pages,
      max_pages: body.max_pages,
      price_cents: reaisToCents(body.price),
      is_active: body.is_active ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.id)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: conflictMessage(error) }, { status: error.message.includes('no_overlap') ? 409 : 500 });
  if (!data) return NextResponse.json({ error: 'Faixa não encontrada.' }, { status: 404 });

  await logAdminAction(supabase, auth.session.id, 'update_binding_price_tier', 'service_binding_price_tiers', data.id, {
    service_id: data.service_id,
    min_pages: data.min_pages,
    max_pages: data.max_pages,
    price_cents: data.price_cents,
    is_active: data.is_active,
  });
  return NextResponse.json(data);
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const auth = await requireApiAdminPermission('manage_pricing');
  if (!auth.success) return auth.errorResponse;
  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return NextResponse.json({ error: 'Faixa inválida.' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('service_binding_price_tiers')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Faixa não encontrada.' }, { status: 404 });
  await logAdminAction(supabase, auth.session.id, 'delete_binding_price_tier', 'service_binding_price_tiers', id);
  return NextResponse.json({ success: true });
}
