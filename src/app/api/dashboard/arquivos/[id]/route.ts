import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/security/admin-input';
import { validateCsrfOrigin } from '@/lib/security/csrf';

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ success: false, error: 'Requisição não autorizada.' }, { status: 403 });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json({ success: false, error: 'ID inválido.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
  }

  const { data: ownedFile, error: lookupError } = await supabase
    .from('order_files')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ success: false, error: lookupError.message }, { status: 500 });
  if (!ownedFile) return NextResponse.json({ success: false, error: 'Arquivo não encontrado.' }, { status: 404 });

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from('order_files')
    .update({ deleted_at: new Date().toISOString(), status: 'deleted' })
    .eq('id', ownedFile.id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ success: false, error: 'Arquivo não encontrado.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
