import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { isReconciledRevenueOrder } from '@/lib/orders/reconciliation';

export const dynamic = 'force-dynamic';

interface OrderRow {
  id: string;
  total: number | string;
  created_at: string;
  status: string;
  payment_status: string;
  payment_method: string;
}

interface OrderItemRow {
  service_name_snapshot: string | null;
  quantity: number;
}

interface RecentOrderRaw {
  id: string;
  order_number: string;
  guest_name: string | null;
  total: number;
  status: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
}

export async function GET(request: Request) {
  try {
    const auth = await requireApiAdminPermission('read_orders');
    if (!auth.success) return auth.errorResponse;

    const { searchParams } = new URL(request.url);
    const periodResult = z.coerce.number().int().min(1).max(366).safeParse(searchParams.get('period') || '7');
    if (!periodResult.success) return NextResponse.json({ error: 'Período inválido' }, { status: 400 });
    const period = periodResult.data;
    
    const supabase = createServiceRoleClient();
    
    // Calculate start date based on period
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    const startDateString = startDate.toISOString();

    // Fetch orders within period
    const { data: rawOrdersData, error: ordersError } = await supabase
      .from('orders')
      .select('id, total, created_at, status, payment_status, payment_method')
      .gte('created_at', startDateString);

    if (ordersError) throw ordersError;

    const orders = (rawOrdersData || []) as unknown as OrderRow[];

    // Calculate metrics
    const reconciledOrders = orders.filter(isReconciledRevenueOrder);
    const totalOrders = reconciledOrders.length;
    const totalRevenue = reconciledOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Daily Revenue Chart Data (Agrupar por dia)
    const revenueByDayMap = new Map<string, number>();
    const ordersByDayMap = new Map<string, number>();
    
    reconciledOrders.forEach((o) => {
      const day = new Date(String(o.created_at)).toISOString().split('T')[0] ?? '';
      revenueByDayMap.set(day, (revenueByDayMap.get(day) || 0) + Number(o.total || 0));
      ordersByDayMap.set(day, (ordersByDayMap.get(day) || 0) + 1);
    });

    const revenueData = Array.from(revenueByDayMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const ordersData = Array.from(ordersByDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Payment Methods Pie Chart Data
    const paymentMap = new Map<string, number>();
    reconciledOrders.forEach((o) => {
      const method = String(o.payment_method || 'outro');
      paymentMap.set(method, (paymentMap.get(method) || 0) + 1);
    });
    const paymentData = Array.from(paymentMap.entries()).map(([method, count]) => ({ name: method, value: count }));

    // For Top Services, we need order_items
    let topServices: { name: string; quantity: number }[] = [];
    if (reconciledOrders.length > 0) {
      const { data: orderItemsData } = await supabase
        .from('order_items')
        .select('service_name_snapshot, quantity')
        .in('order_id', reconciledOrders.map((o) => o.id));

      const orderItems = (orderItemsData || []) as unknown as OrderItemRow[];
      const serviceMap = new Map<string, number>();
      orderItems.forEach((item) => {
        const sName = item.service_name_snapshot || 'Serviço';
        serviceMap.set(sName, (serviceMap.get(sName) || 0) + item.quantity);
      });
      
      topServices = Array.from(serviceMap.entries())
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);
    }

    // Recent orders table
    const { data: recentOrdersData } = await supabase
      .from('orders')
      .select('id, order_number, guest_name, total, status, created_at, profiles ( full_name )')
      .order('created_at', { ascending: false })
      .limit(10);

    const recentOrders = ((recentOrdersData || []) as unknown as RecentOrderRaw[]).map(o => ({
      id: o.id,
      order_number: o.order_number,
      customer_name: o.profiles?.full_name || o.guest_name || 'Cliente',
      total: o.total,
      status: o.status,
      created_at: o.created_at,
    }));

    return NextResponse.json({
      metrics: {
        totalRevenue,
        totalOrders,
        averageTicket,
        topItem: topServices[0]?.name ?? 'Nenhum',
        reconciliation: 'Somente pagamentos confirmados em estados operacionais elegíveis.',
      },
      charts: {
        revenue: revenueData,
        orders: ordersData,
        payment: paymentData,
        topServices
      },
      recentOrders
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    console.error('Dashboard API Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
