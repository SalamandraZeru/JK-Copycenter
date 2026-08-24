import { describe, expect, it } from 'vitest';
import { readPublicSupabaseConfig, readServiceRoleKey } from '@/lib/supabase/config';

describe('configuração Supabase obrigatória', () => {
  it('rejeita valores ausentes ou de template', () => {
    expect(() => readPublicSupabaseConfig('', 'key')).toThrow('NEXT_PUBLIC_SUPABASE_URL');
    expect(() => readPublicSupabaseConfig('https://placeholder-project.supabase.co', 'key')).toThrow('NEXT_PUBLIC_SUPABASE_URL');
    expect(() => readPublicSupabaseConfig('https://example.supabase.co', '')).toThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    expect(() => readServiceRoleKey('placeholder-service-role')).toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('aceita configuração explícita', () => {
    expect(readPublicSupabaseConfig('https://example.supabase.co', 'public-key')).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'public-key',
    });
    expect(readServiceRoleKey('server-only-key')).toBe('server-only-key');
  });
});
