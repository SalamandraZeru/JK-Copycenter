import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { logAdminAction } from '@/lib/auth/admin';
import type { TablesUpdate } from '@/types';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';
import { reaisToCents } from '@/lib/pricing/money';
import { inspectServicePublication, type CatalogState } from '@/lib/catalog/publication';

export const dynamic = 'force-dynamic';

const serviceFields = {
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(5000).nullable().optional(),
  image_url: z.string().trim().max(2_000_000).nullable().optional(),
  base_price: z.coerce.number().min(0).max(1_000_000).optional(),
  catalog_state: z.enum(['draft', 'review', 'published', 'inactive']).optional(),
  pricing_fallback_behavior: z.enum(['use_base', 'block']).optional(),
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
        catalog_state: 'draft',
        pricing_fallback_behavior: body.pricing_fallback_behavior ?? 'block',
        is_active: false,
        sort_order: Number(body.sort_order) || 0,
        catalog_updated_by: auth.session.id,
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

    const { data: current, error: currentError } = await supabase
      .from('services')
      .select('id, name, slug, base_price_cents, pricing_fallback_behavior, catalog_state, published_at')
      .eq('id', body.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 });

    const nextState = (body.catalog_state ?? current.catalog_state) as CatalogState;
    const nextBasePriceCents = body.base_price === undefined
      ? current.base_price_cents
      : reaisToCents(body.base_price);
    const nextFallbackBehavior = body.pricing_fallback_behavior ?? current.pricing_fallback_behavior;
    const readiness = await inspectServicePublication(supabase, current.id, {
      name: body.name ?? current.name,
      slug: body.slug ?? current.slug,
      basePriceCents: nextBasePriceCents,
      fallbackBehavior: nextFallbackBehavior,
      state: nextState,
    });
    if (!readiness.ready) {
      return NextResponse.json({ error: readiness.errors.join(' ') }, { status: 422 });
    }

    const updatePayload: TablesUpdate<'services'> = {
      updated_at: new Date().toISOString(),
      catalog_updated_by: auth.session.id,
    };
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.slug !== undefined) updatePayload.slug = body.slug;
    if (body.description !== undefined) updatePayload.description = body.description;
    // Categorias pertencem apenas aos produtos de papelaria.
    updatePayload.category_id = null;
    if (body.image_url !== undefined) updatePayload.image_url = body.image_url;
    if (body.base_price !== undefined) updatePayload.base_price_cents = nextBasePriceCents;
    if (body.pricing_fallback_behavior !== undefined) updatePayload.pricing_fallback_behavior = nextFallbackBehavior;
    if (body.catalog_state !== undefined) {
      updatePayload.catalog_state = nextState;
      updatePayload.is_active = nextState === 'published';
      if (nextState === 'review' || nextState === 'published') updatePayload.reviewed_at = new Date().toISOString();
      if (nextState === 'published' && !current.published_at) updatePayload.published_at = new Date().toISOString();
    }
    if (body.sort_order !== undefined) updatePayload.sort_order = Number(body.sort_order);

    const { data, error } = await supabase
      .from('services')
      .update(updatePayload)
      .eq('id', body.id)
      .select()
      .single();

    if (error) throw error;

    await logAdminAction(supabase, auth.session.id, 'update_service', 'services', data.id, {
      name: data.name,
      catalog_state: data.catalog_state,
      catalog_version: data.catalog_version,
      warnings: readiness.warnings,
    });

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
      .update({
        deleted_at: new Date().toISOString(),
        catalog_state: 'inactive',
        is_active: false,
        catalog_updated_by: auth.session.id,
      })
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
