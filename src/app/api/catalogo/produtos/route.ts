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
    let query = supabase
      .from('products')
      .select('id, category_id, name, slug, description, image_url, price, stock_quantity, sort_order, categories!inner(slug)', { count: 'exact' })
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })
      .range(offset, offset + limit - 1);

    if (categoriaSlug && categoriaSlug !== 'todas') {
      query = query.eq('categories.slug', categoriaSlug);
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
