import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const pagination = z.object({
      page: z.coerce.number().int().min(1).max(100_000),
      limit: z.coerce.number().int().min(1).max(100),
    }).safeParse({ page: url.searchParams.get('page') || '1', limit: url.searchParams.get('limit') || '10' });
    if (!pagination.success) return NextResponse.json({ success: false, error: 'Paginação inválida' }, { status: 400 });
    const { page, limit } = pagination.data;
    const offset = (page - 1) * limit;

    // RLS garante que o cliente só vê seus próprios pedidos no banco
    const { data: orders, error, count } = await supabase
      .from('orders')
      .select('id, order_number, status, total, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        orders,
        total: count || 0
      }
    }, { status: 200 });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
