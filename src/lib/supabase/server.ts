import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';
import { readPublicSupabaseConfig } from './config';

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = readPublicSupabaseConfig();

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Ignored when called in Server Components
          }
        },
      },
    }
  );
}
