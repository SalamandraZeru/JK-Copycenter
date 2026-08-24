import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import type { OrderStatus, PaymentMethod } from '@/types';

export const dynamic = 'force-dynamic';

const filtersSchema = z.object({
  status: z.enum(['created', 'awaiting_payment', 'confirmed', 'in_production', 'ready', 'completed', 'cancelled']).nullable(),
  payment: z.enum(['pix', 'card', 'cash']).nullable(),
  q: z.string().trim().max(100).nullable(),
});

interface OrderListRow {
  id: string;
  order_number: string;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  total: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: string;
  created_at: string;
  delivery_type: string;
  profiles: { full_name: string | null } | null;
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiAdminPermission('read_orders');
    if (!auth.success) return auth.errorResponse;

    const { searchParams } = new URL(request.url);
    const filters = filtersSchema.safeParse({
      status: searchParams.get('status') || null,
      payment: searchParams.get('payment') || null,
      q: searchParams.get('q') || null,
    });
    if (!filters.success) return NextResponse.json({ error: 'Filtros inválidos' }, { status: 400 });
    const { status, payment, q } = filters.data;

    const supabase = createServiceRoleClient();
    
    let query = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        guest_name,
        guest_email,
        guest_phone,
        total,
        status,
        payment_method,
        payment_status,
        created_at,
        delivery_type,
        profiles (full_name)
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status as OrderStatus);
    if (payment) query = query.eq('payment_method', payment as PaymentMethod);
    if (q) {
      query = query.ilike('order_number', `%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      // Fallback empty array on DB empty/unseeded state
      return NextResponse.json([]);
    }

    // Format customer name from profile or guest
    const orders = (data || []) as unknown as OrderListRow[];
    const formatted = orders.map((order) => ({
      ...order,
      customer_name: order.profiles?.full_name || order.guest_name || 'Cliente (Guest)',
    }));

    return NextResponse.json(formatted);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
