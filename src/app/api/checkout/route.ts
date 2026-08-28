import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { processCheckout } from '@/lib/orders/checkout';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import type { CheckoutPayload, CheckoutResult } from '@/types/index';
import { checkoutIntentSchema } from '@/lib/orders/checkout-intent';
import { readGuestUploadSession } from '@/lib/upload/guest-session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    if (!validateCsrfOrigin(origin, host)) {
      return NextResponse.json(
        { success: false, error: 'Cross-origin request rejected (CSRF protection)' },
        { status: 403 }
      );
    }

    const body: unknown = await req.json();
    const parseResult = checkoutIntentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: `Invalid input parameters: ${parseResult.error.message}` },
        { status: 400 }
      );
    }

    const validData = parseResult.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id;

    const guestEmail = validData.guestEmail;

    if (!userId && !guestEmail) {
      return NextResponse.json(
        { success: false, error: 'Informe um e-mail válido para consultar o pedido como visitante.' },
        { status: 400 }
      );
    }

    const context: { userId?: string; guestEmail?: string; guestUploadSessionHash?: string } = {};
    if (userId) {
      context.userId = userId;
    } else if (guestEmail) {
      context.guestEmail = guestEmail;
    }
    const guestUploadSessionHash = !userId ? readGuestUploadSession(req)?.hash : undefined;
    if (guestUploadSessionHash) context.guestUploadSessionHash = guestUploadSessionHash;

    const payload: CheckoutPayload = {
      idempotencyKey: validData.idempotencyKey,
      items: validData.items.map((item) => ({
        serviceId: item.serviceId && item.serviceId.trim() !== '' ? item.serviceId.trim() : undefined,
        productId: item.productId && item.productId.trim() !== '' ? item.productId.trim() : undefined,
        attributeIds: item.attributeIds,
        fieldValues: item.fieldValues.map((fv) => ({
          fieldKey: fv.fieldKey,
          value: fv.value,
        })),
        pageCount: item.pageCount,
        isFrontAndBack: item.isFrontAndBack,
        quantity: item.quantity,
        fileIds: item.fileIds,
        bindingFileIds: item.bindingFileIds,
        dimensions: item.dimensions,
        bookletPaddingApproved: item.bookletPaddingApproved,
        artworkBleedAcknowledged: item.artworkBleedAcknowledged,
      })),
      deliveryType: validData.deliveryType,
      deliveryAddressId: validData.deliveryAddressId,
      deliveryAddress: validData.deliveryAddress,
      customerName: validData.customerName,
      customerPhone: validData.customerPhone,
      guestEmail,
      paymentMethod: validData.paymentMethod,
      notes: validData.notes,
    };

    const supabaseAdmin = createServiceRoleClient();
    const result: CheckoutResult = await processCheckout(payload, context, supabaseAdmin);

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('IDEMPOTENCY_CONFLICT')) {
      return NextResponse.json(
        { success: false, error: 'Idempotency conflict' },
        { status: 409 }
      );
    }

    const code = error instanceof Error ? error.message : 'CHECKOUT_FAILED';
    const clientErrors: Record<string, { message: string; status: number }> = {
      FILE_ACCESS_DENIED: {
        message: 'Um ou mais arquivos não pertencem à sessão atual ou já não estão disponíveis. Volte ao carrinho, reconfigure o serviço e envie os arquivos novamente.',
        status: 409,
      },
      FILE_PAGE_COUNT_UNCONFIRMED: {
        message: 'Não foi possível confirmar as páginas do arquivo. Envie o arquivo novamente ou fale com a equipe pelo WhatsApp.',
        status: 409,
      },
      DELIVERY_UNAVAILABLE: { message: 'Entrega temporariamente indisponível.', status: 409 },
      PICKUP_UNAVAILABLE: { message: 'Retirada temporariamente indisponível.', status: 409 },
      DELIVERY_ADDRESS_REQUIRED: { message: 'Informe o endereço para entrega.', status: 400 },
      DELIVERY_AREA_UNAVAILABLE: { message: 'O endereço informado está fora da área de entrega.', status: 400 },
    };
    const clientError = clientErrors[code];

    return NextResponse.json(
      { success: false, error: clientError?.message || 'Não foi possível concluir o pedido. Tente novamente em instantes.' },
      { status: clientError?.status || 500 }
    );
  }
}
