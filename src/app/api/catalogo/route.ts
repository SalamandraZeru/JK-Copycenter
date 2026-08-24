import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 60; // ISR cache for 60 seconds

export async function GET() {
  const supabase = await createClient();

  try {
    // 1. Fetch categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, name, slug, description, image_url, parent_id, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (catError) throw catError;

    // 2. Fetch services
    const { data: services, error: servError } = await supabase
      .from('services')
      .select('id, category_id, name, slug, description, image_url, base_price, sort_order')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (servError) throw servError;

    return NextResponse.json({
      success: true,
      categories: categories || [],
      services: services || [],
    });
  } catch (caught: unknown) {
    return NextResponse.json({
      success: false,
      error: caught instanceof Error ? caught.message : 'Catálogo indisponível.',
    }, { status: 500 });
  }
}
