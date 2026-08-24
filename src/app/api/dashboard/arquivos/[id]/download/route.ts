import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/security/admin-input';
import { createAuditedSignedFileUrl } from '@/lib/upload/signed-url';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const params = await props.params;
  if (!isUuid(params.id)) {
    return NextResponse.json({ success: false, error: 'ID inválido.' }, { status: 400 });
  }
  const sessionClient = await createClient();
  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const { data: file, error } = await admin
    .from('order_files')
    .select('id, storage_path, status, expires_at, deleted_at, storage_deleted_at')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .is('guest_owner_hash', null)
    .maybeSingle();
  const expired = file?.expires_at && new Date(file.expires_at).getTime() <= Date.now();
  if (error || !file || !file.storage_path || file.deleted_at || file.storage_deleted_at
      || expired || !['ready', 'confirmed'].includes(file.status)) {
    return NextResponse.json({ success: false, error: 'Arquivo não disponível.' }, { status: 404 });
  }

  try {
    const signed = await createAuditedSignedFileUrl(admin, {
      fileId: file.id,
      storagePath: file.storage_path,
      actorUserId: user.id,
      purpose: 'customer_download',
      requestId: request.headers.get('x-request-id') || undefined,
    });
    return NextResponse.json({ success: true, ...signed }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao gerar acesso temporário.' }, { status: 500 });
  }
}
