import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import { isUuid } from '@/lib/security/admin-input';
import { readGuestUploadSession } from '@/lib/upload/guest-session';

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const params = await props.params;
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ success: false, error: 'Requisição não autorizada.' }, { status: 403 });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json({ success: false, error: 'ID inválido.' }, { status: 400 });
  }

  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  const guestSession = user ? null : readGuestUploadSession(request);
  if (!user && !guestSession) {
    return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  let query = admin
    .from('order_files')
    .select('id, user_id, guest_owner_hash, order_id, status')
    .eq('id', params.id)
    .is('order_id', null)
    .eq('status', 'ready');
  query = user
    ? query.eq('user_id', user.id).is('guest_owner_hash', null)
    : query.is('user_id', null).eq('guest_owner_hash', guestSession?.hash || '');
  const { data: file, error: lookupError } = await query.maybeSingle();
  if (lookupError) return NextResponse.json({ success: false, error: 'Falha ao consultar arquivo.' }, { status: 500 });
  if (!file) return NextResponse.json({ success: false, error: 'Arquivo não encontrado.' }, { status: 404 });

  const now = new Date().toISOString();
  const { data: removed, error } = await admin
    .from('order_files')
    .update({ status: 'deleted', deleted_at: now })
    .eq('id', file.id)
    .eq('status', 'ready')
    .select('id')
    .maybeSingle();
  if (error || !removed) {
    return NextResponse.json({ success: false, error: 'Arquivo foi alterado; atualize a página.' }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}
