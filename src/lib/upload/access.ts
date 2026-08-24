import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { PageCountMethod } from '@/types';

export interface FileOwnerContext {
  userId?: string;
  guestUploadSessionHash?: string;
}

export interface AuthorizedCheckoutFile {
  id: string;
  user_id: string | null;
  guest_owner_hash: string | null;
  order_id: string | null;
  original_name: string;
  page_count: number;
  page_count_method: PageCountMethod;
  status: string;
  expires_at: string | null;
  deleted_at: string | null;
}

export async function loadAuthorizedReadyFiles(
  supabase: SupabaseClient<Database>,
  fileIds: readonly string[],
  owner: FileOwnerContext,
): Promise<AuthorizedCheckoutFile[]> {
  const uniqueIds = Array.from(new Set(fileIds));
  if (uniqueIds.length !== fileIds.length) throw new Error('FILE_ACCESS_DENIED');
  if (uniqueIds.length === 0) return [];
  if (!owner.userId && !owner.guestUploadSessionHash) throw new Error('FILE_ACCESS_DENIED');

  const { data, error } = await supabase
    .from('order_files')
    .select('id, user_id, guest_owner_hash, order_id, original_name, page_count, page_count_method, status, expires_at, deleted_at')
    .in('id', uniqueIds);
  if (error || !data || data.length !== uniqueIds.length) throw new Error('FILE_ACCESS_DENIED');

  const now = Date.now();
  const authorized = data.every((file) => {
    if (file.deleted_at || file.status !== 'ready' || file.order_id) return false;
    if (file.expires_at && new Date(file.expires_at).getTime() <= now) return false;
    if (owner.userId) return file.user_id === owner.userId && file.guest_owner_hash === null;
    return file.user_id === null && file.guest_owner_hash === owner.guestUploadSessionHash;
  });
  if (!authorized) throw new Error('FILE_ACCESS_DENIED');
  return data as AuthorizedCheckoutFile[];
}
