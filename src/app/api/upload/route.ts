import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { processUpload } from '@/lib/upload/orchestrator';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import { isUuid } from '@/lib/security/admin-input';
import { readGuestUploadSession } from '@/lib/upload/guest-session';

export const dynamic = 'force-dynamic';

const rateLimitCache = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS = 15;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitCache.get(ip);
  if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitCache.set(ip, { count: 1, timestamp: now });
    return true;
  }
  if (record.count >= MAX_REQUESTS) return false;
  record.count += 1;
  return true;
}

function publicUploadError(error: unknown): { message: string; status: number } {
  const code = error instanceof Error ? error.message : 'UPLOAD_FAILED';
  const clientErrors: Record<string, string> = {
    EMPTY_FILE: 'O arquivo selecionado está vazio.',
    FILE_TOO_LARGE: 'O arquivo excede o limite configurado.',
    INVALID_MAGIC_BYTES: 'A extensão ou o MIME não corresponde ao conteúdo do arquivo.',
    FILE_INTENT_MISMATCH: 'O arquivo não corresponde à intenção de upload.',
    FILE_INTENT_EXPIRED: 'A intenção de upload expirou. Selecione o arquivo novamente.',
    FILE_INTENT_ALREADY_USED: 'A intenção de upload já foi utilizada.',
    FILE_ACCESS_DENIED: 'Arquivo não autorizado.',
    ARCHIVE_BOMB_DETECTED: 'Arquivo compactado rejeitado pelos limites de segurança.',
    ARCHIVE_TOO_LARGE: 'Conteúdo descompactado excede o limite permitido.',
    ARCHIVE_TOO_MANY_ENTRIES: 'Arquivo compactado contém entradas demais.',
    ARCHIVE_FORBIDDEN_ENTRY: 'Arquivo compactado contém conteúdo não permitido.',
    ARCHIVE_DISGUISED_ENTRY: 'Arquivo compactado contém conteúdo disfarçado.',
    ARCHIVE_PATH_TRAVERSAL: 'Arquivo compactado contém path inválido.',
    ARCHIVE_PATH_DEPTH_EXCEEDED: 'Arquivo compactado excede a profundidade de pastas permitida.',
    ARCHIVE_ENCRYPTED: 'Arquivos compactados protegidos por senha não são aceitos.',
    OOXML_ACTIVE_CONTENT: 'Documento contém conteúdo ativo não permitido.',
    PDF_ENCRYPTED: 'PDF protegido por senha não é aceito.',
    PDF_CORRUPTED: 'O PDF está corrompido ou não pode ser lido.',
    RAR_PROCESSING_UNAVAILABLE: 'Arquivos RAR não estão disponíveis nesta infraestrutura.',
    PROCESSING_TIMEOUT: 'O processamento excedeu o tempo permitido.',
  };
  if (clientErrors[code]) return { message: clientErrors[code], status: 400 };
  if (code === 'PROCESSING_CAPACITY_EXCEEDED') {
    return { message: 'Há muitos arquivos sendo processados. Tente novamente em instantes.', status: 503 };
  }
  if (code === 'FILE_INTENT_NOT_FOUND') return { message: 'Intenção não encontrada.', status: 404 };
  return { message: 'Não foi possível processar o arquivo com segurança.', status: 500 };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ success: false, error: 'Requisição não autorizada.' }, { status: 403 });
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ success: false, error: 'Muitas requisições. Aguarde um instante.' }, { status: 429 });
  }

  try {
    const formData = await request.formData();
    const fileValue = formData.get('file');
    const intentValue = formData.get('intentId');
    if (!(fileValue instanceof File) || typeof intentValue !== 'string' || !isUuid(intentValue)) {
      return NextResponse.json({ success: false, error: 'Upload inválido.' }, { status: 400 });
    }

    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    const guestSession = user ? null : readGuestUploadSession(request);
    if (!user && !guestSession) {
      return NextResponse.json({ success: false, error: 'Sessão de upload obrigatória.' }, { status: 401 });
    }

    const owner = user
      ? { userId: user.id }
      : { guestUploadSessionHash: guestSession?.hash || '' };
    const result = await processUpload(fileValue, intentValue, owner, createServiceRoleClient());

    return NextResponse.json({
      success: true,
      fileId: result.fileId,
      originalName: result.originalName,
      sizeBytes: result.sizeBytes,
      pageCount: result.pageCount,
      countMethod: result.pageCountMethod,
      mimeType: result.mimeType,
      fileType: result.fileType,
      status: result.status,
    }, { status: 200 });
  } catch (error) {
    const publicError = publicUploadError(error);
    return NextResponse.json({ success: false, error: publicError.message }, { status: publicError.status });
  }
}
