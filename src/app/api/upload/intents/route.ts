import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { validateCsrfOrigin } from '@/lib/security/csrf';
import { loadSystemConfig } from '@/lib/orders/config';
import { validateUploadMetadata } from '@/lib/upload/validator';
import {
  attachGuestUploadCookie,
  ensureGuestUploadSession,
} from '@/lib/upload/guest-session';

export const dynamic = 'force-dynamic';

const intentRateLimit = new Map<string, { count: number; startedAt: number }>();
function allowIntent(ip: string): boolean {
  const now = Date.now();
  const current = intentRateLimit.get(ip);
  if (!current || now - current.startedAt > 60_000) {
    intentRateLimit.set(ip, { count: 1, startedAt: now });
    return true;
  }
  if (current.count >= 20) return false;
  current.count += 1;
  return true;
}

const intentSchema = z.object({
  originalName: z.string().min(1).max(500),
  declaredMime: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive(),
}).strict();

function settingInteger(settings: Record<string, string>, key: string): number {
  const value = Number(settings[key]);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`CONFIG_UNAVAILABLE: ${key}`);
  return value;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!validateCsrfOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return NextResponse.json({ success: false, error: 'Requisição não autorizada.' }, { status: 403 });
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allowIntent(ip)) {
    return NextResponse.json({ success: false, error: 'Muitas intenções de upload.' }, { status: 429 });
  }

  const parsed = intentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Metadados de arquivo inválidos.' }, { status: 400 });
  }

  try {
    const metadata = validateUploadMetadata(parsed.data.originalName, parsed.data.declaredMime);
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    const guestSession = user ? null : ensureGuestUploadSession(request);
    const admin = createServiceRoleClient();
    const settings = await loadSystemConfig(admin, [
      'upload_max_size_bytes',
      'upload_max_files_per_order',
      'upload_intent_expiry_minutes',
    ]);
    const maxBytes = settingInteger(settings, 'upload_max_size_bytes');
    const maxFiles = settingInteger(settings, 'upload_max_files_per_order');
    const expiryMinutes = settingInteger(settings, 'upload_intent_expiry_minutes');
    if (parsed.data.sizeBytes > maxBytes) throw new Error('FILE_TOO_LARGE');

    let countQuery = admin
      .from('order_files')
      .select('id', { count: 'exact', head: true })
      .is('order_id', null)
      .is('deleted_at', null)
      .in('status', ['intended', 'uploading', 'processing', 'ready']);
    countQuery = user
      ? countQuery.eq('user_id', user.id)
      : countQuery.eq('guest_owner_hash', guestSession?.hash || '');
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    if ((count || 0) >= maxFiles) throw new Error('FILE_LIMIT_REACHED');

    const intentExpiresAt = new Date(Date.now() + expiryMinutes * 60_000).toISOString();
    const { data: intent, error } = await admin
      .from('order_files')
      .insert({
        ownership_version: 1,
        user_id: user?.id || null,
        guest_owner_hash: guestSession?.hash || null,
        original_name: metadata.originalName,
        safe_name: metadata.safeName,
        declared_mime_type: metadata.declaredMime,
        mime_type: metadata.declaredMime,
        file_type: metadata.fileType,
        storage_path: null,
        size_bytes: parsed.data.sizeBytes,
        page_count: 0,
        page_count_method: 'pending_confirmation',
        status: 'intended',
        intent_expires_at: intentExpiresAt,
      })
      .select('id, intent_expires_at')
      .single();
    if (error || !intent) throw error || new Error('INTENT_CREATE_FAILED');

    const response = NextResponse.json({
      success: true,
      intentId: intent.id,
      expiresAt: intent.intent_expires_at,
    }, { status: 201 });
    if (guestSession) attachGuestUploadCookie(response, guestSession);
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : 'INTENT_CREATE_FAILED';
    const status = code === 'FILE_TOO_LARGE' || code === 'FILE_LIMIT_REACHED' ? 413 : 400;
    return NextResponse.json({ success: false, error: code }, { status });
  }
}
