import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const supabase = createServiceRoleClient();
  const keys = [
    'delivery_fee_cents',
    'delivery_city',
    'delivery_state',
    'delivery_enabled',
    'pickup_enabled',
  ];
  const { data, error } = await supabase
    .from('store_settings')
    .select('key, value')
    .in('key', keys);
  if (error || !data || data.length !== keys.length) {
    return NextResponse.json({ error: 'Configuração de entrega indisponível.' }, { status: 503 });
  }
  return NextResponse.json(Object.fromEntries(data.map((setting) => [setting.key, setting.value])));
}
