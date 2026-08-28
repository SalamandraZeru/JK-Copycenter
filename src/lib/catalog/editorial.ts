import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

export type CatalogEditability =
  | { editable: true }
  | { editable: false; status: 404 | 409; error: string };

/**
 * Draft and review are the only editorial states that can change the
 * commercial contract. The matching database trigger is the concurrency and
 * direct-SQL boundary; this helper makes the API response understandable.
 */
export async function getCatalogEditability(
  supabase: SupabaseClient<Database>,
  serviceId: string,
): Promise<CatalogEditability> {
  const { data, error } = await supabase
    .from('services')
    .select('id, catalog_state, deleted_at')
    .eq('id', serviceId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.deleted_at || data.catalog_state === 'inactive') {
    return { editable: false, status: 404, error: 'Serviço inexistente, excluído ou inativo.' };
  }
  if (data.catalog_state === 'published') {
    return {
      editable: false,
      status: 409,
      error: 'O serviço está publicado. Mova-o para revisão antes de alterar campos, vínculos ou regras de preço.',
    };
  }
  return { editable: true };
}
