import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export async function loadSystemConfig(
  supabase: SupabaseClient<Database>,
  keys: string[]
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('store_settings')
    .select('key, value')
    .in('key', keys);

  if (error) {
    throw new Error(`Failed to load store settings: ${error.message}`);
  }

  const configMap: Record<string, string> = {};
  for (const item of data) {
    configMap[item.key] = typeof item.value === 'string'
      ? item.value
      : JSON.stringify(item.value);
  }

  const missingKeys = keys.filter(k => !(k in configMap));
  if (missingKeys.length > 0) {
    throw new Error(`Missing required store setting keys: ${missingKeys.join(', ')}`);
  }

  return configMap;
}
