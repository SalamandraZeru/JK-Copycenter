import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import { readPublicSupabaseConfig } from './config';

export function createClient() {
  const { url, anonKey } = readPublicSupabaseConfig();

  return createBrowserClient<Database>(url, anonKey);
}
