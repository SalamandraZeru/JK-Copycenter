import { NextResponse } from 'next/server';
import { isUuid } from '@/lib/security/admin-input';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { createAuditedSignedFileUrl } from '@/lib/upload/signed-url';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const params = await props.params;
  const auth = await requireApiAdminPermission('read_orders');
  if (!auth.success) return auth.errorResponse;
  if (!isUuid(params.id)) {
    return NextResponse.json({ success: false, error: 'ID inválido.' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: file, error } = await admin
    .from('order_files')
    .select('id, storage_path, status, expires_at, deleted_at, storage_deleted_at, order_id')
    .eq('id', params.id)
    .not('order_id', 'is', null)
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
      actorAdminId: auth.session.id,
      purpose: 'admin_order_preview',
      requestId: request.headers.get('x-request-id') || undefined,
    });
    return NextResponse.json({ success: true, ...signed }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao gerar acesso temporário.' }, { status: 500 });
  }
}
