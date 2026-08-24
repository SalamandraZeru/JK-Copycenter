import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/supabase';
import type { FileType, PageCountMethod } from '@/types';
import { loadSystemConfig } from '@/lib/orders/config';
import type { FileOwnerContext } from './access';
import {
  canonicalMimeForType,
  validateMagicBytes,
  validateUploadMetadata,
} from './validator';
import { processFileIsolated } from './isolated-processor';

export interface UploadOrchestrationResult {
  fileId: string;
  originalName: string;
  mimeType: string;
  fileType: FileType;
  sizeBytes: number;
  pageCount: number;
  pageCountMethod: PageCountMethod;
  isSuspicious: boolean;
  status: 'ready';
}

interface UploadIntentRecord {
  id: string;
  user_id: string | null;
  guest_owner_hash: string | null;
  original_name: string;
  safe_name: string | null;
  declared_mime_type: string | null;
  file_type: FileType;
  size_bytes: number;
  status: string;
  intent_expires_at: string | null;
}

function requireInteger(settings: Record<string, string>, key: string): number {
  const value = Number(settings[key]);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`CONFIG_UNAVAILABLE: ${key}`);
  return value;
}

function rejectionCode(error: unknown): string {
  const raw = error instanceof Error ? error.message : 'UPLOAD_FAILED';
  const token = raw.match(/[A-Z][A-Z0-9_]{2,99}/)?.[0];
  return token || 'UPLOAD_FAILED';
}

function ownsIntent(intent: UploadIntentRecord, owner: FileOwnerContext): boolean {
  if (owner.userId) {
    return intent.user_id === owner.userId && intent.guest_owner_hash === null;
  }
  return Boolean(owner.guestUploadSessionHash)
    && intent.user_id === null
    && intent.guest_owner_hash === owner.guestUploadSessionHash;
}

export async function processUpload(
  file: File,
  intentId: string,
  owner: FileOwnerContext,
  supabase: SupabaseClient<Database>,
): Promise<UploadOrchestrationResult> {
  const settings = await loadSystemConfig(supabase, [
    'upload_max_size_bytes',
    'upload_processing_timeout_ms',
    'upload_processing_memory_mb',
    'upload_max_concurrent_processing',
    'upload_max_entries',
    'upload_max_depth',
    'upload_max_uncompressed_bytes',
    'zip_max_compression_ratio',
    'data_retention_days',
  ]);
  const maxInputBytes = requireInteger(settings, 'upload_max_size_bytes');
  const retentionDays = requireInteger(settings, 'data_retention_days');

  const { data, error: lookupError } = await supabase
    .from('order_files')
    .select('id, user_id, guest_owner_hash, original_name, safe_name, declared_mime_type, file_type, size_bytes, status, intent_expires_at')
    .eq('id', intentId)
    .maybeSingle();
  if (lookupError || !data) throw new Error('FILE_INTENT_NOT_FOUND');
  const intent = data as UploadIntentRecord;
  if (!ownsIntent(intent, owner)) throw new Error('FILE_ACCESS_DENIED');
  if (intent.status !== 'intended') throw new Error('FILE_INTENT_ALREADY_USED');
  if (!intent.intent_expires_at || new Date(intent.intent_expires_at).getTime() <= Date.now()) {
    await supabase.from('order_files').update({ status: 'expired' }).eq('id', intent.id).eq('status', 'intended');
    throw new Error('FILE_INTENT_EXPIRED');
  }

  let lifecycle: 'intended' | 'uploading' | 'processing' = 'intended';
  let storagePath: string | null = null;
  let storageCreated = false;
  let cleanupRequired = false;

  try {
    const metadata = validateUploadMetadata(file.name, file.type || intent.declared_mime_type || '');
    if (file.size === 0) throw new Error('EMPTY_FILE');
    if (file.size > maxInputBytes) throw new Error('FILE_TOO_LARGE');
    if (metadata.originalName !== intent.original_name
        || metadata.safeName !== intent.safe_name
        || metadata.declaredMime !== intent.declared_mime_type
        || metadata.fileType !== intent.file_type
        || file.size !== intent.size_bytes) {
      throw new Error('FILE_INTENT_MISMATCH');
    }

    storagePath = `private/${intent.id}/${crypto.randomUUID()}.bin`;
    const { data: claimed, error: claimError } = await supabase
      .from('order_files')
      .update({ status: 'uploading', storage_path: storagePath })
      .eq('id', intent.id)
      .eq('status', 'intended')
      .select('id')
      .maybeSingle();
    if (claimError || !claimed) throw new Error('FILE_INTENT_ALREADY_USED');
    lifecycle = 'uploading';

    const buffer = Buffer.from(await file.arrayBuffer());
    const magic = validateMagicBytes(buffer, metadata.declaredMime);
    if (!magic.valid) throw new Error(magic.error || 'INVALID_MAGIC_BYTES');
    const canonicalMime = canonicalMimeForType(metadata.fileType, metadata.declaredMime);
    const contentSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    const { error: storageError } = await supabase.storage
      .from('order-files')
      .upload(storagePath, buffer, {
        contentType: canonicalMime,
        cacheControl: '0',
        upsert: false,
      });
    if (storageError) throw new Error(`STORAGE_UPLOAD_FAILED: ${storageError.message}`);
    storageCreated = true;

    const processingStartedAt = new Date().toISOString();
    const { error: processingStateError } = await supabase
      .from('order_files')
      .update({ status: 'processing', processing_started_at: processingStartedAt })
      .eq('id', intent.id)
      .eq('status', 'uploading');
    if (processingStateError) throw new Error('PROCESSING_STATE_FAILED');
    lifecycle = 'processing';

    const processed = await processFileIsolated(buffer, metadata.fileType, canonicalMime, {
      timeoutMs: requireInteger(settings, 'upload_processing_timeout_ms'),
      memoryMb: requireInteger(settings, 'upload_processing_memory_mb'),
      maxInputBytes,
      maxEntries: requireInteger(settings, 'upload_max_entries'),
      maxDepth: requireInteger(settings, 'upload_max_depth'),
      maxUncompressedBytes: requireInteger(settings, 'upload_max_uncompressed_bytes'),
      maxCompressionRatio: requireInteger(settings, 'zip_max_compression_ratio'),
      maxEntryBytes: maxInputBytes,
      maxImagePixels: 100_000_000,
      maxConcurrentWorkers: requireInteger(settings, 'upload_max_concurrent_processing'),
    });

    const readyAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + retentionDays * 86_400_000).toISOString();
    const { data: ready, error: readyError } = await supabase
      .from('order_files')
      .update({
        status: 'ready',
        mime_type: processed.detectedMime,
        detected_mime_type: processed.detectedMime,
        content_sha256: contentSha256,
        page_count: processed.pageCount,
        page_count_method: processed.pageCountMethod,
        is_suspicious: processed.isSuspicious,
        processing_metadata: processed.metadata as Json,
        ready_at: readyAt,
        expires_at: expiresAt,
        cleanup_required: false,
      })
      .eq('id', intent.id)
      .eq('status', 'processing')
      .select('id')
      .maybeSingle();
    if (readyError || !ready) throw new Error('READY_STATE_FAILED');

    return {
      fileId: intent.id,
      originalName: metadata.originalName,
      mimeType: processed.detectedMime,
      fileType: processed.fileType,
      sizeBytes: file.size,
      pageCount: processed.pageCount,
      pageCountMethod: processed.pageCountMethod,
      isSuspicious: processed.isSuspicious,
      status: 'ready',
    };
  } catch (error) {
    if (storageCreated && storagePath) {
      const { error: cleanupError } = await supabase.storage.from('order-files').remove([storagePath]);
      cleanupRequired = Boolean(cleanupError);
    }

    const code = rejectionCode(error);
    const rejectedAt = new Date().toISOString();
    const { error: rejectionError } = await supabase
      .from('order_files')
      .update({
        status: 'rejected',
        rejected_at: rejectedAt,
        rejection_code: code,
        cleanup_required: cleanupRequired,
        storage_path: cleanupRequired ? storagePath : null,
        storage_deleted_at: storageCreated && !cleanupRequired ? rejectedAt : null,
      })
      .eq('id', intent.id)
      .eq('status', lifecycle);
    if (rejectionError) {
      throw new Error(`ROLLBACK_INCOMPLETE: ${code}`);
    }
    throw new Error(code);
  }
}
