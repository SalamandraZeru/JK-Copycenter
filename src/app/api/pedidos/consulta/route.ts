import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeGuestEmail } from '@/lib/auth/guest';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import { createServiceRoleClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const lookupSchema = z.object({
  orderCode: z.string().trim().uuid('Código de pedido inválido.'),
  email: z.string().trim().email('E-mail inválido.').max(320),
}).strict();

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS_PER_CODE = 10;
const MAX_ATTEMPTS_PER_REQUEST = 20;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function getRequestFingerprint(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return sha256(`${ip}|${userAgent}`);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!validateCsrfOrigin(origin, host)) {
    return NextResponse.json({ success: false, error: 'Requisição não autorizada.' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Dados inválidos.' }, { status: 400 });
  }

  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Código ou e-mail inválido.' }, { status: 400 });
  }

  const orderCode = parsed.data.orderCode;
  const email = normalizeGuestEmail(parsed.data.email);
  const orderCodeHash = sha256(orderCode);
  const requestHash = getRequestFingerprint(req);
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const supabase = createServiceRoleClient();

  const [{ count: codeAttempts, error: codeRateError }, { count: requestAttempts, error: requestRateError }] =
    await Promise.all([
      supabase
        .from('guest_access_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('order_code_hash', orderCodeHash)
        .gte('created_at', since),
      supabase
        .from('guest_access_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('request_hash', requestHash)
        .gte('created_at', since),
    ]);

  if (codeRateError || requestRateError) {
    return NextResponse.json({ success: false, error: 'Consulta temporariamente indisponível.' }, { status: 503 });
  }

  if ((codeAttempts ?? 0) >= MAX_ATTEMPTS_PER_CODE || (requestAttempts ?? 0) >= MAX_ATTEMPTS_PER_REQUEST) {
    return NextResponse.json(
      { success: false, error: 'Muitas tentativas. Aguarde antes de tentar novamente.' },
      { status: 429, headers: { 'Retry-After': String(WINDOW_MINUTES * 60) } }
    );
  }

  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      guest_name,
      status,
      delivery_type,
      delivery_fee,
      subtotal,
      total,
      payment_method,
      payment_status,
      created_at,
      updated_at,
      order_items (
        id,
        service_name_snapshot,
        service_description_snapshot,
        product_name_snapshot,
        quantity,
        pages_count,
        unit_price,
        total_price
      )
    `)
    .eq('order_token', orderCode)
    .eq('guest_email', email)
    .is('user_id', null)
    .gt('guest_access_expires_at', new Date().toISOString())
    .maybeSingle();

  const succeeded = !error && Boolean(order);
  const { error: auditError } = await supabase.from('guest_access_attempts').insert({
    order_code_hash: orderCodeHash,
    request_hash: requestHash,
    succeeded,
  });

  if (auditError) {
    return NextResponse.json({ success: false, error: 'Consulta temporariamente indisponível.' }, { status: 503 });
  }

  if (!succeeded || !order) {
    return NextResponse.json(
      { success: false, error: 'Pedido não encontrado. Confira o código e o e-mail.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: order }, { status: 200 });
}
