import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import { enforceCloudflareRateLimit } from '@/lib/security/cloudflare-rate-limit';
import { readGuestUploadSession } from '@/lib/upload/guest-session';
import { isServiceManualQuoteEnabled } from '@/lib/features/service-manual-quote';
import { graphicQuoteRequestIntentSchema } from '@/lib/orders/graphic-quote-request-intent';
import { processGraphicQuoteRequest } from '@/lib/orders/graphic-quote-request';

export const dynamic = 'force-dynamic';

function publicError(error: unknown): { message: string; status: number } {
  const code = error instanceof Error ? error.message : 'QUOTE_REQUEST_FAILED';
  const errors: Record<string, { message: string; status: number }> = {
    GUEST_EMAIL_REQUIRED: { message: 'Informe um e-mail válido para acompanhar a solicitação.', status: 400 },
    CUSTOMER_CONTACT_REQUIRED: { message: 'Informe nome e telefone para o atendimento.', status: 400 },
    SERVICE_UNAVAILABLE: { message: 'O serviço não está disponível para solicitação.', status: 409 },
    SERVICE_CONFIGURATION_UNAVAILABLE: { message: 'Não foi possível carregar a configuração do serviço.', status: 409 },
    SERVICE_FIELD_DUPLICATED: { message: 'Um campo do serviço foi enviado mais de uma vez.', status: 400 },
    SERVICE_FIELD_INVALID: { message: 'Uma opção selecionada não existe ou está inativa.', status: 400 },
    SERVICE_FIELD_REQUIRED: { message: 'Preencha todos os campos obrigatórios do serviço.', status: 400 },
    SERVICE_FIELD_DEPENDENCY_INVALID: { message: 'A combinação selecionada não é compatível.', status: 400 },
    SERVICE_PAGE_COUNT_OUT_OF_RANGE: { message: 'A quantidade de páginas está fora dos limites deste serviço.', status: 400 },
    BOOKLET_SINGLE_PDF_REQUIRED: { message: 'Envie um único PDF completo para este livreto.', status: 400 },
    BOOKLET_EXACT_PDF_REQUIRED: { message: 'O livreto exige um PDF com contagem de páginas confirmada.', status: 400 },
    BOOKLET_PAGE_MULTIPLE_REQUIRED: { message: 'A quantidade de páginas do livreto deve respeitar o múltiplo configurado.', status: 400 },
    BOOKLET_PADDING_APPROVAL_REQUIRED: { message: 'Confirme a inclusão de páginas técnicas em branco para continuar.', status: 400 },
    SERVICE_DIMENSIONS_REQUIRED: { message: 'Informe largura e altura para este serviço.', status: 400 },
    SERVICE_DIMENSIONS_OUT_OF_RANGE: { message: 'As dimensões informadas estão fora dos limites deste serviço.', status: 400 },
    SERVICE_LENGTH_REQUIRED: { message: 'Informe o comprimento para este serviço.', status: 400 },
    ARTWORK_BLEED_ACKNOWLEDGEMENT_REQUIRED: { message: 'Confirme a ciência sobre sangria e margem segura.', status: 400 },
    FILE_ACCESS_DENIED: { message: 'Um ou mais arquivos não pertencem à sessão atual ou não estão disponíveis.', status: 409 },
    SERVICE_CATALOG_CHANGED: { message: 'O serviço foi atualizado durante o envio. Revise as opções e tente novamente.', status: 409 },
    IDEMPOTENCY_CONFLICT: { message: 'Esta tentativa já foi usada com dados diferentes.', status: 409 },
  };
  return errors[code] || { message: 'Não foi possível criar a solicitação. Tente novamente.', status: 500 };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isServiceManualQuoteEnabled()) {
    return NextResponse.json({ success: false, error: 'Fluxo de orçamento ainda não liberado.' }, { status: 404 });
  }
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ success: false, error: 'Requisição não autorizada.' }, { status: 403 });
  }

  const parsed = graphicQuoteRequestIntentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Dados da solicitação inválidos.' }, { status: 400 });
  }

  try {
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    const guestSession = user ? null : readGuestUploadSession(request);
    if (!user && !guestSession) {
      return NextResponse.json({ success: false, error: 'Sessão de upload obrigatória.' }, { status: 401 });
    }
    const limit = await enforceCloudflareRateLimit(
      request,
      'JK_PRICING_PREVIEW_RATE_LIMIT',
      'graphic-quote-request',
      { userId: user?.id ?? null, guestSessionHash: guestSession?.hash ?? null },
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Muitas solicitações. Aguarde um instante.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }

    const result = await processGraphicQuoteRequest(parsed.data, {
      ...(user ? { userId: user.id } : {}),
      ...(parsed.data.guestEmail ? { guestEmail: parsed.data.guestEmail } : {}),
      ...(guestSession?.hash ? { guestUploadSessionHash: guestSession.hash } : {}),
    }, createServiceRoleClient());
    return NextResponse.json({ success: true, data: result }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    const response = publicError(error);
    return NextResponse.json({ success: false, error: response.message }, { status: response.status });
  }
}
