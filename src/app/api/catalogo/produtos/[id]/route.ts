import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Public, minimal product representation used only to revalidate a cart
 * snapshot. It intentionally exposes neither supplier nor stock-management
 * data; checkout remains the authority for the final order price.
 */
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await props.params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ success: false, error: 'Identificador inválido.' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: product, error } = await supabase
    .from('products')
    .select('id, name, image_url, price')
    .eq('id', id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !product) {
    return NextResponse.json({ success: false, error: 'Produto não encontrado.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: product });
}
