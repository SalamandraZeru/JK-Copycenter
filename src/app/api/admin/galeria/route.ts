import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { logAdminAction } from '@/lib/auth/admin';
import type { TablesUpdate } from '@/types';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';

export const dynamic = 'force-dynamic';

const galleryFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  image_url: z.string().trim().min(1).max(2_000_000),
  service_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(-100_000).max(100_000).optional(),
};
const gallerySchema = z.object(galleryFields);
const createGallerySchema = gallerySchema.strict();
const updateGallerySchema = gallerySchema.partial().extend({ id: z.string().uuid() }).strict();

export async function GET() {
  try {
    const auth = await requireApiAdminPermission('manage_catalog');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('gallery_items')
      .select('id, title, description, image_url, service_id, is_active, sort_order, service:services(name)')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json([]);
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
    const parsed = await parseAdminJson(request, createGallerySchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const { data, error } = await supabase
      .from('gallery_items')
      .insert({
        title: body.title,
        description: body.description || null,
        image_url: body.image_url,
        service_id: body.service_id || null,
        is_active: body.is_active ?? true,
        sort_order: Number(body.sort_order) || 0,
      })
      .select()
      .single();

    if (error) throw error;

    await logAdminAction(supabase, auth.session.id, 'create_gallery_item', 'gallery_items', data.id, { title: data.title });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao criar item da galeria';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireApiAdminPermission('manage_catalog');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    const parsed = await parseAdminJson(request, updateGallerySchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const updatePayload: TablesUpdate<'gallery_items'> = {
      updated_at: new Date().toISOString(),
    };
    if (body.title !== undefined) updatePayload.title = body.title;
    if (body.description !== undefined) updatePayload.description = body.description;
    if (body.image_url !== undefined) updatePayload.image_url = body.image_url;
    if (body.service_id !== undefined) updatePayload.service_id = body.service_id;
    if (body.is_active !== undefined) updatePayload.is_active = body.is_active;
    if (body.sort_order !== undefined) updatePayload.sort_order = Number(body.sort_order);

    const { data, error } = await supabase
      .from('gallery_items')
      .update(updatePayload)
      .eq('id', body.id)
      .select()
      .single();

    if (error) throw error;

    await logAdminAction(supabase, auth.session.id, 'update_gallery_item', 'gallery_items', data.id, { title: data.title });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar item da galeria';
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
      .from('gallery_items')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 });

    await logAdminAction(supabase, auth.session.id, 'delete_gallery_item', 'gallery_items', id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao excluir item da galeria';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
