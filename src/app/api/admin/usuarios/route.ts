import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logAdminAction } from '@/lib/auth/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { parseAdminJson } from '@/lib/security/admin-input';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import type { TablesUpdate } from '@/types';

export const dynamic = 'force-dynamic';

const roleSchema = z.enum(['super_admin', 'admin', 'producao', 'catalogo']);
const createUserSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  role: roleSchema,
  is_active: z.boolean().default(true),
}).strict();

const updateUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(200).optional(),
  full_name: z.string().trim().min(2).max(200).optional(),
  role: roleSchema.optional(),
  is_active: z.boolean().optional(),
}).strict().refine((value) => value.name !== undefined || value.full_name !== undefined || value.role !== undefined || value.is_active !== undefined, {
  message: 'Nenhuma alteração informada.',
});

export async function GET() {
  try {
    const auth = await requireApiAdminPermission('manage_users');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, full_name, role, is_active, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const users = await Promise.all((data || []).map(async (adminUser) => {
      const { data: authUser } = await supabase.auth.admin.getUserById(adminUser.id);
      return { ...adminUser, email: authUser.user?.email || null };
    }));

    return NextResponse.json(users);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao listar usuários';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAdminPermission('manage_users');
  if (!auth.success) return auth.errorResponse;

  const parsed = await parseAdminJson(request, createUserSchema);
  if (!parsed.success) return parsed.errorResponse;

  const supabase = createServiceRoleClient();
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.name },
  });
  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message || 'Não foi possível criar a conta.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('admin_users')
    .insert({
      id: created.user.id,
      full_name: parsed.data.name,
      role: parsed.data.role,
      is_active: parsed.data.is_active ?? true,
      created_by: auth.session.id,
    })
    .select('id, full_name, role, is_active')
    .single();

  if (error) {
    await supabase.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAdminAction(supabase, auth.session.id, 'create_admin_user', 'admin_users', data.id, {
    name: data.full_name,
    role: data.role,
  });
  return NextResponse.json({ ...data, email: parsed.data.email }, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await requireApiAdminPermission('manage_users');
  if (!auth.success) return auth.errorResponse;

  const parsed = await parseAdminJson(request, updateUserSchema);
  if (!parsed.success) return parsed.errorResponse;
  const body = parsed.data;

  if (body.id === auth.session.id && (body.is_active === false || (body.role && body.role !== 'super_admin'))) {
    return NextResponse.json({ error: 'O super administrador não pode remover o próprio acesso.' }, { status: 409 });
  }

  const supabase = createServiceRoleClient();
  const { data: current, error: currentError } = await supabase
    .from('admin_users')
    .select('id, role, is_active')
    .eq('id', body.id)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!current) return NextResponse.json({ error: 'Usuário administrativo não encontrado.' }, { status: 404 });

  const removesSuperAdmin = current.role === 'super_admin' && current.is_active && (body.role !== undefined && body.role !== 'super_admin' || body.is_active === false);
  if (removesSuperAdmin) {
    const { count, error: countError } = await supabase
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'super_admin')
      .eq('is_active', true);
    if (countError) throw countError;
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'É obrigatório manter ao menos um super administrador ativo.' }, { status: 409 });
    }
  }

  const updatePayload: TablesUpdate<'admin_users'> = { updated_at: new Date().toISOString() };
  if (body.role !== undefined) updatePayload.role = body.role;
  if (body.is_active !== undefined) updatePayload.is_active = body.is_active;
  const fullName = body.name || body.full_name;
  if (fullName) updatePayload.full_name = fullName;

  const { data, error } = await supabase
    .from('admin_users')
    .update(updatePayload)
    .eq('id', body.id)
    .select('id, full_name, role, is_active')
    .single();
  if (error) throw error;

  await logAdminAction(supabase, auth.session.id, 'update_admin_user', 'admin_users', data.id, {
    role: data.role,
    is_active: data.is_active,
  });
  return NextResponse.json(data);
}
