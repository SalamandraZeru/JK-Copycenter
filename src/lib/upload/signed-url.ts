import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { loadSystemConfig } from '@/lib/orders/config';

interface SignedFileAccessInput {
  fileId: string;
  storagePath: string;
  purpose: 'customer_download' | 'admin_order_preview';
  actorUserId?: string;
  actorAdminId?: string;
  requestId?: string | undefined;
}

export async function createAuditedSignedFileUrl(
  supabase: SupabaseClient<Database>,
  input: SignedFileAccessInput,
): Promise<{ url: string; expiresAt: string }> {
  const config = await loadSystemConfig(supabase, ['signed_url_expiry_seconds']);
  const expiresIn = Number(config.signed_url_expiry_seconds);
  if (!Number.isSafeInteger(expiresIn) || expiresIn < 30 || expiresIn > 300) {
    throw new Error('SIGNED_URL_CONFIG_UNAVAILABLE');
  }

  const { data, error } = await supabase.storage
    .from('order-files')
    .createSignedUrl(input.storagePath, expiresIn);
  if (error || !data?.signedUrl) {
    await supabase.from('file_access_audit').insert({
      file_id: input.fileId,
      actor_user_id: input.actorUserId || null,
      actor_admin_id: input.actorAdminId || null,
      purpose: input.purpose,
      outcome: 'storage_error',
      request_id: input.requestId || null,
      expires_in_seconds: expiresIn,
    });
    throw new Error('SIGNED_URL_FAILED');
  }

  const { error: auditError } = await supabase.from('file_access_audit').insert({
    file_id: input.fileId,
    actor_user_id: input.actorUserId || null,
    actor_admin_id: input.actorAdminId || null,
    purpose: input.purpose,
    outcome: 'issued',
    request_id: input.requestId || null,
    expires_in_seconds: expiresIn,
  });
  if (auditError) throw new Error('FILE_ACCESS_AUDIT_FAILED');

  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}
