import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { readPublicSupabaseConfig, readServiceRoleKey } from './config';

export function createServiceRoleClient() {
  const { url } = readPublicSupabaseConfig();
  const serviceRoleKey = readServiceRoleKey();

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
