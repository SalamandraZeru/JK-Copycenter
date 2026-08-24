import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { logAdminAction } from '@/lib/auth/admin';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';

export const dynamic = 'force-dynamic';

const commonFields = {
  name: z.string().trim().min(1).max(200),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(-100_000).max(100_000).optional(),
};
const attributeInputSchema = z.union([
  z.object({ type: z.literal('attribute'), group_id: z.string().uuid(), ...commonFields }).strict(),
  z.object({ type: z.undefined().optional(), ...commonFields }).strict(),
]);

export async function GET() {
  try {
    const auth = await requireApiAdminPermission('manage_pricing');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    
    // Pegar grupos com seus atributos
    const { data: groups, error: groupsError } = await supabase
      .from('attribute_groups')
      .select('*, attributes (*)')
      .order('sort_order', { ascending: true });

    if (groupsError) {
      return NextResponse.json([]);
    }

    return NextResponse.json(groups || []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiAdminPermission('manage_pricing');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    const parsed = await parseAdminJson(request, attributeInputSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    if (body.type === 'attribute') {
      // Criar atributo dentro de um grupo
      const { data, error } = await supabase
        .from('attributes')
        .insert({
          group_id: body.group_id,
          name: body.name,
          is_active: body.is_active ?? true,
          sort_order: Number(body.sort_order) || 0,
        })
        .select()
        .single();

      if (error) throw error;
      await logAdminAction(supabase, auth.session.id, 'create_attribute', 'attributes', data.id, { name: data.name });
      return NextResponse.json(data);
    } else {
      // Criar grupo de atributos
      if (!body.name) {
        return NextResponse.json({ error: 'Nome do grupo é obrigatório' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('attribute_groups')
        .insert({
          name: body.name,
          is_active: body.is_active ?? true,
          sort_order: Number(body.sort_order) || 0,
        })
        .select()
        .single();

      if (error) throw error;
      await logAdminAction(supabase, auth.session.id, 'create_attribute_group', 'attribute_groups', data.id, { name: data.name });
      return NextResponse.json(data);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao criar atributo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireApiAdminPermission('manage_pricing');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!isUuid(id) || (type !== null && type !== 'attribute')) {
      return NextResponse.json({ error: 'ID não informado' }, { status: 400 });
    }

    if (type === 'attribute') {
      const { data, error } = await supabase.from('attributes').delete().eq('id', id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Atributo não encontrado' }, { status: 404 });
      await logAdminAction(supabase, auth.session.id, 'delete_attribute', 'attributes', id);
    } else {
      const { data, error } = await supabase.from('attribute_groups').delete().eq('id', id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 });
      await logAdminAction(supabase, auth.session.id, 'delete_attribute_group', 'attribute_groups', id);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao excluir';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
