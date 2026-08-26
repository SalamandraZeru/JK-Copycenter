import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60; // ISR cache for 60 seconds

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const categoriaSlug = searchParams.get('categoria');
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
          ? 'id, name, slug, description, image_url, price, stock_quantity, sort_order, product_categories!inner(category_id)'
          : 'id, name, slug, description, image_url, price, stock_quantity, sort_order',
        { count: 'exact' },
      )
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .range(offset, offset + limit - 1);

    if (selectedCategoryId) {
      query = query.eq('product_categories.category_id', selectedCategoryId);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || [],
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
