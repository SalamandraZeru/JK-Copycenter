import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { parseAdminJson } from '@/lib/security/admin-input';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import { pushSubscriptionSchema } from '@/lib/push/subscription';

export const dynamic = 'force-dynamic';

const subscribeSchema = z.object({ subscription: pushSubscriptionSchema }).strict();
const unsubscribeSchema = z.object({ endpoint: z.string().trim().min(20).max(1000) }).strict();

function csrfRejected(request: Request) {
  return !validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'));
}

/** Este aparelho passa a receber aviso de pedidos novos. */
export async function POST(request: Request) {
  if (csrfRejected(request)) return NextResponse.json({ error: 'Requisição não autorizada.' }, { status: 403 });
  const auth = await requireApiAdminPermission('read_orders');
  if (!auth.success) return auth.errorResponse;
  const parsed = await parseAdminJson(request, subscribeSchema);
  if (!parsed.success) return parsed.errorResponse;

  const { subscription } = parsed.data;
  const supabase = createServiceRoleClient();
  // O mesmo aparelho pertence a um só admin: quem ativou por último fica com ele.
  await supabase.from('push_subscriptions').delete().eq('audience', 'admin').eq('endpoint', subscription.endpoint);
  const { error } = await supabase.from('push_subscriptions').insert({
    audience: 'admin',
    admin_user_id: auth.session.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  });
  if (error) return NextResponse.json({ error: 'Não foi possível ativar os avisos.' }, { status: 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}

/** Desliga os avisos deste aparelho. */
export async function DELETE(request: Request) {
  if (csrfRejected(request)) return NextResponse.json({ error: 'Requisição não autorizada.' }, { status: 403 });
  const auth = await requireApiAdminPermission('read_orders');
  if (!auth.success) return auth.errorResponse;
  const parsed = await parseAdminJson(request, unsubscribeSchema);
  if (!parsed.success) return parsed.errorResponse;

  await createServiceRoleClient().from('push_subscriptions').delete()
    .eq('audience', 'admin').eq('admin_user_id', auth.session.id).eq('endpoint', parsed.data.endpoint);
  return NextResponse.json({ success: true });
}
