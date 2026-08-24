import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import { createClient } from '@/lib/supabase/server';

const favoriteSchema = z.object({
  order_id: z.string().uuid(),
  name: z.string().trim().max(200).nullable().optional(),
}).strict();

export async function POST(request: Request) {
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ success: false, error: 'Requisição não autorizada.' }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });

  const parsed = await parseAdminJson(request, favoriteSchema);
  if (!parsed.success) return parsed.errorResponse;

  const { data, error } = await supabase
    .from('favorite_orders')
    .insert({ user_id: user.id, order_id: parsed.data.order_id, name: parsed.data.name ?? null })
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: Request) {
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ success: false, error: 'Requisição não autorizada.' }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 });
  const { data, error } = await supabase
    .from('favorite_orders')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ success: false, error: 'Favorito não encontrado' }, { status: 404 });
  return NextResponse.json({ success: true });
}
