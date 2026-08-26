import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { previewCheckout } from '@/lib/orders/checkout';
import { checkoutIntentSchema } from '@/lib/orders/checkout-intent';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import { readGuestUploadSession } from '@/lib/upload/guest-session';
import { enforceCloudflareRateLimit } from '@/lib/security/cloudflare-rate-limit';
import type { CheckoutPayload, CheckoutQuote } from '@/types/checkout';

export const dynamic = 'force-dynamic';

function clientError(error: unknown): { message: string; status: number } {
  const code = error instanceof Error ? error.message : 'CHECKOUT_PREVIEW_FAILED';
  const mapped: Record<string, { message: string; status: number }> = {
    FILE_ACCESS_DENIED: { message: 'Um ou mais arquivos não pertencem à sessão atual. Reenvie o arquivo antes de continuar.', status: 409 },
    DELIVERY_UNAVAILABLE: { message: 'Entrega temporariamente indisponível.', status: 409 },
    PICKUP_UNAVAILABLE: { message: 'Retirada temporariamente indisponível.', status: 409 },
    DELIVERY_ADDRESS_REQUIRED: { message: 'Informe o endereço para entrega.', status: 400 },
    DELIVERY_AREA_UNAVAILABLE: { message: 'O endereço informado está fora da área de entrega.', status: 400 },
  };
  return mapped[code] || { message: 'Não foi possível atualizar a cotação. Revise os itens e tente novamente.', status: 400 };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    if (!validateCsrfOrigin(req.headers.get('origin'), req.headers.get('host'))) {
      return NextResponse.json({ success: false, error: 'Requisição não autorizada.' }, { status: 403 });
    }

    const parsed = checkoutIntentSchema.safeParse(await req.json() as unknown);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Dados de checkout inválidos.' }, { status: 400 });
    }

    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    const guestSession = user ? null : readGuestUploadSession(req);
    const limit = await enforceCloudflareRateLimit(
      req,
      'JK_PRICING_PREVIEW_RATE_LIMIT',
      'checkout-preview',
      { userId: user?.id ?? null, guestSessionHash: guestSession?.hash ?? null },
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Muitas solicitações de cotação. Tente novamente em instantes.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }

    const valid = parsed.data;
    const guestEmail = valid.guestEmail;
    if (!user && !guestEmail) {
      return NextResponse.json({ success: false, error: 'Informe um e-mail válido para consultar o pedido como visitante.' }, { status: 400 });
    }

    const context: { userId?: string; guestEmail?: string; guestUploadSessionHash?: string } = user
      ? { userId: user.id }
      : { ...(guestEmail ? { guestEmail } : {}), ...(guestSession?.hash ? { guestUploadSessionHash: guestSession.hash } : {}) };
    const payload: CheckoutPayload = {
      idempotencyKey: valid.idempotencyKey,
      items: valid.items.map((item) => ({
        ...(item.serviceId ? { serviceId: item.serviceId } : {}),
        ...(item.productId ? { productId: item.productId } : {}),
        attributeIds: item.attributeIds,
        fieldValues: item.fieldValues.map(({ fieldKey, value }) => ({ fieldKey, value })),
        pageCount: item.pageCount,
        isFrontAndBack: item.isFrontAndBack,
        quantity: item.quantity,
        fileIds: item.fileIds,
        bindingFileIds: item.bindingFileIds,
      })),
      deliveryType: valid.deliveryType,
      ...(valid.deliveryAddressId ? { deliveryAddressId: valid.deliveryAddressId } : {}),
      ...(valid.deliveryAddress ? { deliveryAddress: valid.deliveryAddress } : {}),
      ...(valid.customerName ? { customerName: valid.customerName } : {}),
      ...(valid.customerPhone ? { customerPhone: valid.customerPhone } : {}),
      ...(guestEmail ? { guestEmail } : {}),
      paymentMethod: valid.paymentMethod,
      ...(valid.notes ? { notes: valid.notes } : {}),
    };
    const quote: CheckoutQuote = await previewCheckout(payload, context, createServiceRoleClient());
    return NextResponse.json({ success: true, data: quote });
  } catch (error) {
    const response = clientError(error);
    return NextResponse.json({ success: false, error: response.message }, { status: response.status });
  }
}
