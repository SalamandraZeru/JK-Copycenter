import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import type { AdminRole } from '@/types';
import { canPerform, AdminAction } from './permissions';

export interface AdminUserSession {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

export async function getAdminSession(): Promise<AdminUserSession | null> {
  const supabase = await createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: adminUser, error: dbError } = await supabase
    .from('admin_users')
    .select('id, full_name, role, is_active')
    .eq('id', user.id)
    .single();

  if (dbError || !adminUser || !adminUser.is_active) {
    return null;
  }

  return {
    id: adminUser.id,
    email: user.email ?? '',
    name: adminUser.full_name,
    role: adminUser.role as AdminRole,
  };
}

export async function requireAdminSession(): Promise<AdminUserSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect('/admin/login');
  }
  return session;
}

export async function requireAdminPermission(action: AdminAction): Promise<AdminUserSession> {
  const session = await requireAdminSession();
  if (!canPerform(session.role, action)) {
    redirect('/admin/dashboard'); // Or another 'access denied' page
  }
  return session;
}

export async function logAdminAction(
  supabase: SupabaseClient,
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {}
) {
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(adminId);
  const { error } = await supabase.from('audit_logs').insert({
    admin_user_id: isValidUuid ? adminId : null,
    action,
    entity: entityType,
    entity_id: entityId,
    new_value: details,
  });
  if (error) throw new Error(`AUDIT_LOG_FAILED: ${error.message}`);
}
