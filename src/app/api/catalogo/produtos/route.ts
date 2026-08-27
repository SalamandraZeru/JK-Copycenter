import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60; // ISR cache for 60 seconds

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const categoriaSlug = searchParams.get('categoria');
  const search = (searchParams.get('q') || '').trim().slice(0, 120);
  const sort = searchParams.get('ordem') || 'nome';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 12;
  const offset = (page - 1) * limit;

  try {
    let selectedCategoryId: string | null = null;
    if (categoriaSlug && categoriaSlug !== 'todas') {
      const { data: category, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', categoriaSlug)
        .eq('catalog_scope', 'stationery')
        .eq('is_active', true)
        .maybeSingle();
      if (categoryError) throw categoryError;

      if (!category) {
        return NextResponse.json({
          success: true,
          data: [],
          count: 0,
          totalPages: 0,
          currentPage: page,
        });
      }
      selectedCategoryId = category.id;
    }

    let query = supabase
      .from('products')
      .select(
        selectedCategoryId
          ? 'id, name, slug, sku, description, image_url, price, stock_quantity, stock_control_enabled, reserved_quantity, sort_order, product_categories!inner(category_id)'
          : 'id, name, slug, sku, description, image_url, price, stock_quantity, stock_control_enabled, reserved_quantity, sort_order',
        { count: 'exact' },
      )
      .eq('is_active', true)
      .is('deleted_at', null);

    if (selectedCategoryId) {
      query = query.eq('product_categories.category_id', selectedCategoryId);
    }
    if (search) query = query.ilike('name', `%${search}%`);
    if (sort === 'menor_preco') query = query.order('price_cents', { ascending: true }).order('name', { ascending: true });
    else if (sort === 'maior_preco') query = query.order('price_cents', { ascending: false }).order('name', { ascending: true });
    else query = query.order('sort_order', { ascending: true }).order('name', { ascending: true });

    const { data, count, error } = await query.range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: ((data || []) as unknown as Array<{
        id: string;
        name: string;
        slug: string;
        sku: string | null;
        description: string | null;
        image_url: string | null;
        price: number;
        stock_quantity: number | null;
        stock_control_enabled: boolean;
        reserved_quantity: number;
        sort_order: number;
      }>).map(({ stock_control_enabled, reserved_quantity, stock_quantity, ...product }) => ({
        ...product,
        // The catalog sees only sellable quantity. Physical and reserved
        // balances remain available only to the administrative area.
        stock_quantity: stock_control_enabled && stock_quantity !== null
          ? Math.max(0, stock_quantity - reserved_quantity)
          : null,
      })),
      count: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      currentPage: page
    });
  } catch (caught: unknown) {
    return NextResponse.json({
      success: false,
      error: caught instanceof Error ? caught.message : 'Catálogo indisponível.',
    }, { status: 500 });
  }
}
