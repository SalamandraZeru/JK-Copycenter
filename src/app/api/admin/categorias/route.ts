import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { logAdminAction } from '@/lib/auth/admin';
import type { TablesUpdate } from '@/types';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';

export const dynamic = 'force-dynamic';

const categoryFields = {
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(5000).nullable().optional(),
  image_url: z.string().trim().max(2_000_000).nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(-100_000).max(100_000).optional(),
};
const categorySchema = z.object(categoryFields);
const createCategorySchema = categorySchema.strict();
const updateCategorySchema = categorySchema.partial().extend({ id: z.string().uuid() }).strict();

export async function GET() {
  try {
    const auth = await requireApiAdminPermission('manage_catalog');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('catalog_scope', 'stationery')
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
    const parsed = await parseAdminJson(request, createCategorySchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: body.name,
        slug: body.slug,
        description: body.description || null,
        image_url: body.image_url || null,
        catalog_scope: 'stationery',
        is_active: body.is_active ?? true,
        sort_order: Number(body.sort_order) || 0,
      })
      .select()
      .single();

    if (error) throw error;

    await logAdminAction(supabase, auth.session.id, 'create_category', 'categories', data.id, { name: data.name });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao criar categoria';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireApiAdminPermission('manage_catalog');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    const parsed = await parseAdminJson(request, updateCategorySchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const updatePayload: TablesUpdate<'categories'> = {
      updated_at: new Date().toISOString(),
    };
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.slug !== undefined) updatePayload.slug = body.slug;
    if (body.description !== undefined) updatePayload.description = body.description;
    if (body.image_url !== undefined) updatePayload.image_url = body.image_url;
    if (body.is_active !== undefined) updatePayload.is_active = body.is_active;
    if (body.sort_order !== undefined) updatePayload.sort_order = Number(body.sort_order);

    const { data, error } = await supabase
      .from('categories')
      .update(updatePayload)
      .eq('id', body.id)
      .eq('catalog_scope', 'stationery')
      .select()
      .single();

    if (error) throw error;

    await logAdminAction(supabase, auth.session.id, 'update_category', 'categories', data.id, { name: data.name });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar categoria';
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

    const { data, error } = await supabase
      .from('categories')
      .update({ is_active: false })
      .eq('id', id)
      .eq('catalog_scope', 'stationery')
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 });

    await logAdminAction(supabase, auth.session.id, 'delete_category', 'categories', id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao excluir categoria';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
