export interface PublicSupabaseConfig {
  url: string;
  anonKey: string;
}

function requireConfiguredValue(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized || normalized.includes('placeholder') || normalized.includes('your-project-ref')) {
    throw new Error(`Configuração obrigatória ausente ou inválida: ${name}`);
  }
  return normalized;
}

export function readPublicSupabaseConfig(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
): PublicSupabaseConfig {
  return {
    url: requireConfiguredValue('NEXT_PUBLIC_SUPABASE_URL', url),
    anonKey: requireConfiguredValue('NEXT_PUBLIC_SUPABASE_ANON_KEY', anonKey),
  };
}

export function readServiceRoleKey(value = process.env.SUPABASE_SERVICE_ROLE_KEY): string {
  return requireConfiguredValue('SUPABASE_SERVICE_ROLE_KEY', value);
}
