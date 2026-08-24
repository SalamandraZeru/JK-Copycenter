import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';

export const dynamic = 'force-dynamic';

interface ProductionOrderItem {
  service_name_snapshot: string | null;
  quantity: number;
}

interface ProductionOrderRow {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  created_at: string;
  order_items: ProductionOrderItem[];
}

export async function GET() {
  try {
    const auth = await requireApiAdminPermission('manage_production');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();

    // A fila inicia somente depois do pagamento manual confirmado.
    const activeStatuses: Array<'confirmed' | 'in_production' | 'ready'> = ['confirmed', 'in_production', 'ready'];

    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, 
        order_number, 
        status,
        payment_status,
        created_at,
        order_items ( service_name_snapshot, quantity )
      `)
      .in('status', activeStatuses)
      .order('created_at', { ascending: true }); // Fila: mais antigos primeiro

    if (error) {
      return NextResponse.json([]);
    }

    const rows = (data || []) as unknown as ProductionOrderRow[];
    return NextResponse.json(rows);
  } catch (error: unknown) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Não foi possível carregar a fila de produção.',
    }, { status: 500 });
  }
}
