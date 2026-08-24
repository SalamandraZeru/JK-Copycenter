import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { createServiceRoleClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
}).strict();

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireApiAdminPermission('read_audit');
  if (!auth.success) return auth.errorResponse;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Paginação inválida.' }, { status: 400 });
  const { page, limit } = parsed.data;
  const start = (page - 1) * limit;
  const supabase = createServiceRoleClient();
  const { data, count, error } = await supabase
    .from('audit_logs')
    .select('id, admin_user_id, action, entity, entity_id, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(start, start + limit - 1);
  if (error) return NextResponse.json({ error: 'Não foi possível carregar a auditoria.' }, { status: 500 });

  const actorIds = Array.from(new Set((data || []).map((entry) => entry.admin_user_id).filter(Boolean))) as string[];
  const { data: actors, error: actorsError } = actorIds.length > 0
    ? await supabase.from('admin_users').select('id, full_name').in('id', actorIds)
    : { data: [], error: null };
  if (actorsError) return NextResponse.json({ error: 'Não foi possível carregar os responsáveis.' }, { status: 500 });
  const actorName = new Map((actors || []).map((actor) => [actor.id, actor.full_name]));

  return NextResponse.json({
    data: (data || []).map((entry) => ({
      id: entry.id,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entity_id,
      createdAt: entry.created_at,
      actor: entry.admin_user_id ? actorName.get(entry.admin_user_id) || 'Administrador removido' : 'Sistema',
    })),
    total: count || 0,
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
