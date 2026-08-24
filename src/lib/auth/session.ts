import { createClient } from '@/lib/supabase/server';
import type { AdminUser } from '@/types';
import type { Session } from '@supabase/supabase-js';
import { canPerform, type AdminAction } from './permissions';

export async function getClientSession(): Promise<Session | null> {
  const supabase = await createClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session) return null;
  return session;
}

export async function getAdminSession(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id, full_name, role, is_active, email:id') // we don't have email in admin_users, it comes from auth
    .eq('id', user.id)
    .eq('is_active', true)
    .single();

  if (!adminUser) return null;

  return {
    id: adminUser.id,
    full_name: adminUser.full_name,
    role: adminUser.role,
    is_active: adminUser.is_active,
    email: user.email || '',
  };
}

export async function requireAdminRole(action: AdminAction): Promise<AdminUser> {
  const admin = await getAdminSession();

  if (!admin) {
    throw new Error('Unauthorized: Admin session required');
  }

  if (!canPerform(admin.role, action)) {
    throw new Error('Forbidden: Insufficient permissions for this action');
  }

  return admin;
}
