import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';

export const dynamic = 'force-dynamic';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    const auth = await requireApiAdminPermission('manage_catalog');
    if (!auth.success) return auth.errorResponse;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folderValue = formData.get('folder');
    const folder = typeof folderValue === 'string' ? folderValue : 'catalog';

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const fileExtension = EXTENSION_BY_MIME[file.type];
    if (!fileExtension) {
      return NextResponse.json(
        { error: 'Formato de arquivo inválido. Apenas PNG, JPEG e WEBP são permitidos.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Tamanho máximo permitido de 10MB excedido.' },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9][a-z0-9/-]{0,99}$/i.test(folder) || folder.includes('..') || folder.startsWith('/')) {
      return NextResponse.json({ error: 'Pasta de destino inválida.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const cleanFileName = `${folder}/${crypto.randomUUID()}.${fileExtension}`;

    // Upload to 'catalog-images' bucket
    const { error: uploadError } = await supabase.storage
      .from('catalog-images')
      .upload(cleanFileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: 'Não foi possível armazenar a imagem.' }, { status: 503 });
    }

    const { data: publicUrlData } = supabase.storage
      .from('catalog-images')
      .getPublicUrl(cleanFileName);

    return NextResponse.json({
      url: publicUrlData.publicUrl,
      fileName: cleanFileName,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao fazer upload da imagem.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
