import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { logAdminAction } from '@/lib/auth/admin';
import type { TablesUpdate } from '@/types';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';
import { reaisToCents } from '@/lib/pricing/money';

export const dynamic = 'force-dynamic';

const productFields = {
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(5000).nullable().optional(),
  category_ids: z.array(z.string().uuid()).max(50).optional(),
  image_url: z.string().trim().max(2_000_000).nullable().optional(),
  sku: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/).optional(),
  unit_label: z.string().trim().min(1).max(40).optional(),
  package_quantity: z.coerce.number().int().min(1).max(100_000_000).optional(),
  price: z.coerce.number().min(0).max(1_000_000).optional(),
  stock_quantity: z.union([z.coerce.number().int().min(0).max(100_000_000), z.literal(''), z.null()]).optional(),
  stock_control_enabled: z.boolean().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(-100_000).max(100_000).optional(),
};
const productSchema = z.object(productFields);
const createProductSchema = productSchema.strict();
const updateProductSchema = productSchema.partial().extend({ id: z.string().uuid() }).strict();

async function replaceProductCategories(
  supabase: ReturnType<typeof createServiceRoleClient>,
  productId: string,
  categoryIds: string[],
) {
  const uniqueCategoryIds = Array.from(new Set(categoryIds));
  const { error } = await supabase.rpc('replace_product_categories', {
    p_product_id: productId,
    p_category_ids: uniqueCategoryIds,
  });
  if (error) throw error;
}

function normalizedStock(value: number | '' | null | undefined): number | null {
  return value === null || value === '' || value === undefined ? null : Number(value);
}

export async function GET() {
  try {
    const auth = await requireApiAdminPermission('manage_catalog');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    
    const { data, error } = await supabase
      .from('products')
      .select('*, product_categories (category_id, categories (id, name))')
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
    const parsed = await parseAdminJson(request, createProductSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;
    const stockQuantity = normalizedStock(body.stock_quantity);
    if (!body.sku || !body.unit_label || body.package_quantity === undefined) {
      return NextResponse.json({ error: 'SKU, unidade de venda e quantidade por embalagem são obrigatórios.' }, { status: 400 });
    }
    if (body.stock_control_enabled && stockQuantity === null) {
      return NextResponse.json({ error: 'Informe o saldo inicial ao ativar o controle de estoque.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        name: body.name,
        slug: body.slug,
        description: body.description || null,
        category_id: null,
        image_url: body.image_url || null,
        sku: body.sku,
        unit_label: body.unit_label,
        package_quantity: body.package_quantity,
        price_cents: reaisToCents(body.price ?? 0),
        stock_quantity: stockQuantity,
        stock_control_enabled: body.stock_control_enabled ?? false,
        is_active: body.is_active ?? true,
        sort_order: Number(body.sort_order) || 0,
      })
      .select()
      .single();

    if (error) throw error;

    try {
      await replaceProductCategories(supabase, data.id, body.category_ids ?? []);
    } catch (categoryError) {
      // O produto nunca deve ficar público se a associação de categorias falhar.
      await supabase
        .from('products')
        .update({ is_active: false, deleted_at: new Date().toISOString() })
        .eq('id', data.id);
      throw categoryError;
    }

    await logAdminAction(supabase, auth.session.id, 'create_product', 'products', data.id, {
      name: data.name,
      sku: data.sku,
      category_count: (body.category_ids ?? []).length,
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao criar produto';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireApiAdminPermission('manage_catalog');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    const parsed = await parseAdminJson(request, updateProductSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    if (body.stock_control_enabled === true) {
      const requestedStock = normalizedStock(body.stock_quantity);
      if (body.stock_quantity !== undefined && requestedStock === null) {
        return NextResponse.json({ error: 'Informe o saldo ao manter o controle de estoque ativo.' }, { status: 400 });
      }
      if (body.stock_quantity === undefined) {
        const { data: currentProduct, error: currentProductError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', body.id)
          .is('deleted_at', null)
          .maybeSingle();
        if (currentProductError || !currentProduct || currentProduct.stock_quantity === null) {
          return NextResponse.json({ error: 'Informe o saldo ao ativar o controle de estoque.' }, { status: 400 });
        }
      }
    }

    const updatePayload: TablesUpdate<'products'> = {
      updated_at: new Date().toISOString(),
    };
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.slug !== undefined) updatePayload.slug = body.slug;
    if (body.description !== undefined) updatePayload.description = body.description;
    if (body.image_url !== undefined) updatePayload.image_url = body.image_url;
    if (body.sku !== undefined) updatePayload.sku = body.sku;
    if (body.unit_label !== undefined) updatePayload.unit_label = body.unit_label;
    if (body.package_quantity !== undefined) updatePayload.package_quantity = Number(body.package_quantity);
    if (body.price !== undefined) updatePayload.price_cents = reaisToCents(body.price);
    if (body.stock_quantity !== undefined) {
      updatePayload.stock_quantity = normalizedStock(body.stock_quantity);
    }
    if (body.stock_control_enabled !== undefined) updatePayload.stock_control_enabled = body.stock_control_enabled;
    if (body.is_active !== undefined) updatePayload.is_active = body.is_active;
    if (body.sort_order !== undefined) updatePayload.sort_order = Number(body.sort_order);

    const { data, error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', body.id)
      .select()
      .single();

    if (error) throw error;

    if (body.category_ids !== undefined) {
      await replaceProductCategories(supabase, data.id, body.category_ids);
    }

    await logAdminAction(supabase, auth.session.id, 'update_product', 'products', data.id, {
      name: data.name,
      sku: data.sku,
      category_count: body.category_ids?.length,
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao atualizar produto';
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

    // Preserve order history and catalog auditability.
    const { data, error } = await supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString(), is_active: false })
      .eq('id', id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });

    await logAdminAction(supabase, auth.session.id, 'delete_product', 'products', id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao excluir produto';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
