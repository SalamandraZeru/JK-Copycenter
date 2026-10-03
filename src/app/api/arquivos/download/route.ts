import { createServiceRoleClient } from '@/lib/supabase/admin';
import { getOrderFile, verifyOrderFileDownloadToken } from '@/lib/storage/order-files';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
  'Referrer-Policy': 'no-referrer',
};

function notAvailable(status: number): Response {
  return new Response('Arquivo não disponível.', {
    status,
    headers: { ...PRIVATE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

// Entrega um arquivo de pedido a partir de um link temporário assinado.
// O link só é emitido depois da checagem de permissão e auditoria em
// createAuditedSignedFileUrl; aqui o estado do arquivo é conferido de novo.
export async function GET(request: Request): Promise<Response> {
  const token = verifyOrderFileDownloadToken(new URL(request.url).searchParams.get('t'));
  if (!token) return notAvailable(403);

  const admin = createServiceRoleClient();
  const { data: file, error } = await admin
    .from('order_files')
    .select('id, storage_path, status, expires_at, deleted_at, storage_deleted_at, safe_name, mime_type')
    .eq('id', token.fileId)
    .maybeSingle();
  const expired = file?.expires_at && new Date(file.expires_at).getTime() <= Date.now();
  if (error || !file || file.storage_path !== token.storagePath || file.deleted_at
      || file.storage_deleted_at || expired || !['ready', 'confirmed'].includes(file.status)) {
    return notAvailable(404);
  }

  const object = await getOrderFile(token.storagePath).catch(() => null);
  if (!object) return notAvailable(404);

  const fileName = (file.safe_name || 'arquivo').replace(/["\\\r\n]/g, '_');
  return new Response(object.body, {
    headers: {
      ...PRIVATE_HEADERS,
      'Content-Type': file.mime_type || 'application/octet-stream',
      'Content-Length': String(object.size),
      'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
