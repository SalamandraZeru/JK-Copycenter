import crypto from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';
import type { Database } from '@/types/supabase';
import { processUpload } from '@/lib/upload/orchestrator';
import { loadAuthorizedReadyFiles } from '@/lib/upload/access';
import { createAuditedSignedFileUrl } from '@/lib/upload/signed-url';
import { createZipFixture } from '../helpers/zip-fixture';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const canRun = Boolean(url && serviceKey);
const clientUrl = url || 'http://127.0.0.1:54321';
const clientKey = serviceKey || 'integration-test-not-configured';

describe.skipIf(!canRun)('Etapa 04 - lifecycle real local', () => {
  const admin = createClient<Database>(clientUrl, clientKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userAId = crypto.randomUUID();
  const userBId = crypto.randomUUID();
  const createdFileIds: string[] = [];
  const storagePaths: string[] = [];

  beforeAll(async () => {
    const users: Array<{ id: string; email: string }> = [
      { id: userAId, email: `etapa04-a-${userAId}@example.test` },
      { id: userBId, email: `etapa04-b-${userBId}@example.test` },
    ];
    for (const user of users) {
      const { error } = await admin.auth.admin.createUser({
        id: user.id, email: user.email, password: crypto.randomUUID(), email_confirm: true,
      });
      if (error) throw error;
    }
  });

  afterAll(async () => {
    if (storagePaths.length > 0) await admin.storage.from('order-files').remove(storagePaths);
    if (createdFileIds.length > 0) {
      await admin.from('file_access_audit').delete().in('file_id', createdFileIds);
      await admin.from('order_files').delete().in('id', createdFileIds);
    }
    await admin.auth.admin.deleteUser(userAId);
    await admin.auth.admin.deleteUser(userBId);
  });

  async function createIntent(
    fileType: 'pdf' | 'zip',
    originalName: string,
    declaredMime: string,
    sizeBytes: number,
  ): Promise<string> {
    const id = crypto.randomUUID();
    createdFileIds.push(id);
    const { error } = await admin.from('order_files').insert({
      id,
      ownership_version: 1,
      user_id: userAId,
      guest_owner_hash: null,
      original_name: originalName,
      safe_name: originalName,
      declared_mime_type: declaredMime,
      mime_type: declaredMime,
      file_type: fileType,
      storage_path: null,
      size_bytes: sizeBytes,
      page_count: 0,
      page_count_method: 'pending_confirmation',
      status: 'intended',
      intent_expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    if (error) throw error;
    return id;
  }

  it('READY pertence ao dono, IDOR falha, URL é curta/expira e acesso é auditado', async () => {
    const document = await PDFDocument.create();
    document.addPage();
    const pdf = Buffer.from(await document.save());
    const intentId = await createIntent('pdf', 'documento.pdf', 'application/pdf', pdf.length);
    const file = new File([pdf], 'documento.pdf', { type: 'application/pdf' });

    const result = await processUpload(file, intentId, { userId: userAId }, admin);
    expect(result.status).toBe('ready');
    expect('storagePath' in result).toBe(false);

    const authorized = await loadAuthorizedReadyFiles(admin, [intentId], { userId: userAId });
    expect(authorized).toHaveLength(1);
    await expect(loadAuthorizedReadyFiles(admin, [intentId], { userId: userBId }))
      .rejects.toThrow('FILE_ACCESS_DENIED');

    const { data: stored, error: storedError } = await admin
      .from('order_files')
      .select('storage_path, access_count')
      .eq('id', intentId)
      .single();
    if (storedError || !stored?.storage_path) throw storedError || new Error('missing storage path');
    storagePaths.push(stored.storage_path);
    expect(stored.storage_path).toMatch(/^private\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.bin$/);

    const signed = await createAuditedSignedFileUrl(admin, {
      fileId: intentId,
      storagePath: stored.storage_path,
      actorUserId: userAId,
      purpose: 'customer_download',
    });
    expect(new Date(signed.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(120_000);
    const { data: accessRow } = await admin.from('order_files').select('access_count').eq('id', intentId).single();
    expect(accessRow?.access_count).toBe(1);

    const { data: oneSecond } = await admin.storage.from('order-files').createSignedUrl(stored.storage_path, 1);
    expect(oneSecond?.signedUrl).toBeTruthy();
    const immediate = await fetch(oneSecond?.signedUrl || '');
    expect(immediate.ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const expired = await fetch(oneSecond?.signedUrl || '');
    expect(expired.ok).toBe(false);

    const { error: expireError } = await admin
      .from('order_files')
      .update({ status: 'expired', expires_at: new Date(Date.now() - 1_000).toISOString() })
      .eq('id', intentId);
    if (expireError) throw expireError;
    await expect(loadAuthorizedReadyFiles(admin, [intentId], { userId: userAId }))
      .rejects.toThrow('FILE_ACCESS_DENIED');
  }, 30_000);

  it('falha após upload privado remove objeto e persiste REJECTED', async () => {
    const maliciousZip = createZipFixture([{ name: 'malware.exe', data: Buffer.from('MZ') }]);
    const intentId = await createIntent('zip', 'materiais.zip', 'application/zip', maliciousZip.length);
    const file = new File([Uint8Array.from(maliciousZip)], 'materiais.zip', { type: 'application/zip' });
    await expect(processUpload(file, intentId, { userId: userAId }, admin))
      .rejects.toThrow('ARCHIVE_FORBIDDEN_ENTRY');

    const { data: rejected, error } = await admin
      .from('order_files')
      .select('status, storage_path, cleanup_required, rejection_code')
      .eq('id', intentId)
      .single();
    if (error) throw error;
    expect(rejected.status).toBe('rejected');
    expect(rejected.storage_path).toBeNull();
    expect(rejected.cleanup_required).toBe(false);
    expect(rejected.rejection_code).toBe('ARCHIVE_FORBIDDEN_ENTRY');
  }, 30_000);
});
