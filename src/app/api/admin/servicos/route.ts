import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { logAdminAction } from '@/lib/auth/admin';
import type { TablesUpdate } from '@/types';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';
import { reaisToCents } from '@/lib/pricing/money';

export const dynamic = 'force-dynamic';

const serviceFields = {
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(5000).nullable().optional(),
  image_url: z.string().trim().max(2_000_000).nullable().optional(),
  base_price: z.coerce.number().min(0).max(1_000_000).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(-100_000).max(100_000).optional(),
};
const serviceSchema = z.object(serviceFields);
const createServiceSchema = serviceSchema.strict();
const updateServiceSchema = serviceSchema.partial().extend({ id: z.string().uuid() }).strict();

export async function GET() {
  try {
    const auth = await requireApiAdminPermission('manage_catalog');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

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
    const auth = await requireApiAdminPermission('manage_catalog');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    const parsed = await parseAdminJson(request, createServiceSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const { data, error } = await supabase
      .from('services')
      .insert({
        name: body.name,
        slug: body.slug,
        description: body.description || null,
        category_id: null,
        image_url: body.image_url || null,
        base_price_cents: reaisToCents(body.base_price ?? 0),
        is_active: body.is_active ?? true,
        sort_order: Number(body.sort_order) || 0,
      })
      .select()
      .single();

    if (error) throw error;

    await logAdminAction(supabase, auth.session.id, 'create_service', 'services', data.id, { name: data.name });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao criar serviço';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireApiAdminPermission('manage_catalog');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    const parsed = await parseAdminJson(request, updateServiceSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const updatePayload: TablesUpdate<'services'> = {
      updated_at: new Date().toISOString(),
    };
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.slug !== undefined) updatePayload.slug = body.slug;
    if (body.description !== undefined) updatePayload.description = body.description;
    // Categorias pertencem apenas aos produtos de papelaria.
    updatePayload.category_id = null;
    if (body.image_url !== undefined) updatePayload.image_url = body.image_url;
    if (body.base_price !== undefined) updatePayload.base_price_cents = reaisToCents(body.base_price);
    if (body.is_active !== undefined) updatePayload.is_active = body.is_active;
    if (body.sort_order !== undefined) updatePayload.sort_order = Number(body.sort_order);

    const { data, error } = await supabase
      .from('services')
      .update(updatePayload)
      .eq('id', body.id)
      .select()
      .single();

    if (error) throw error;

    await logAdminAction(supabase, auth.session.id, 'update_service', 'services', data.id, { name: data.name });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar serviço';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireApiAdminPermission('manage_catalog');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!isUuid(id)) {
      return NextResponse.json({ error: 'ID não informado' }, { status: 400 });
    }

    // Soft delete
    const { data, error } = await supabase
      .from('services')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 });

    await logAdminAction(supabase, auth.session.id, 'delete_service', 'services', id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao excluir serviço';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
