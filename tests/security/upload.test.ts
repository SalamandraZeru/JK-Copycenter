import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  sanitizeFilename,
  validateMagicBytes,
  validateUploadMetadata,
} from '@/lib/upload/validator';
import { processFileIsolated } from '@/lib/upload/isolated-processor';
import { createZipFixture } from '../helpers/zip-fixture';

const limits = {
  timeoutMs: 10_000,
  memoryMb: 128,
  maxInputBytes: 50 * 1024 * 1024,
  maxEntries: 20,
  maxDepth: 1,
  maxUncompressedBytes: 10 * 1024 * 1024,
  maxCompressionRatio: 100,
  maxEntryBytes: 5 * 1024 * 1024,
  maxImagePixels: 10_000_000,
  maxConcurrentWorkers: 2,
};

describe('Segurança de upload', () => {
  it('executável disfarçado de PDF é rejeitado pelos magic bytes', () => {
    const executable = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    expect(validateMagicBytes(executable, 'application/pdf').valid).toBe(false);
  });

  it('extensão e MIME divergentes são rejeitados antes do upload', () => {
    expect(() => validateUploadMetadata('arquivo.pdf', 'image/png'))
      .toThrow('EXTENSION_MIME_MISMATCH');
  });

  it('path traversal é rejeitado, não reinterpretado', () => {
    expect(() => validateUploadMetadata('../../segredo.pdf', 'application/pdf'))
      .toThrow('PATH_TRAVERSAL');
    expect(() => validateUploadMetadata('..\\segredo.pdf', 'application/pdf'))
      .toThrow('PATH_TRAVERSAL');
  });

  it('PDF legítimo é processado em subprocesso e mantém contagem exata', async () => {
    const document = await PDFDocument.create();
    document.addPage();
    document.addPage();
    const buffer = Buffer.from(await document.save());
    const result = await processFileIsolated(buffer, 'pdf', 'application/pdf', limits);
    expect(result.pageCount).toBe(2);
    expect(result.pageCountMethod).toBe('exact');
  });

  it('PDF com cabeçalho válido, mas estrutura corrompida, é rejeitado', async () => {
    const malformedPdf = Buffer.from('%PDF-1.7\nthis is intentionally malformed\n');
    await expect(processFileIsolated(malformedPdf, 'pdf', 'application/pdf', limits))
      .rejects.toThrow('PDF_CORRUPTED');
  });

  it('ZIP com executável interno é rejeitado integralmente', async () => {
    const archive = createZipFixture([{ name: 'malware.exe', data: Buffer.from('MZ') }]);
    await expect(processFileIsolated(archive, 'zip', 'application/zip', limits))
      .rejects.toThrow('ARCHIVE_FORBIDDEN_ENTRY');
  });

  it('ZIP bomb é rejeitado antes de abrir a entrada', async () => {
    const archive = createZipFixture([{
      name: 'documento.pdf',
      data: Buffer.from('%PDF-1.4'),
      compress: true,
      declaredUncompressedSize: 5 * 1024 * 1024,
    }]);
    await expect(processFileIsolated(archive, 'zip', 'application/zip', limits))
      .rejects.toThrow('ARCHIVE_BOMB_DETECTED');
  });

  it('ZIP com path traversal é rejeitado', async () => {
    const archive = createZipFixture([{ name: '../documento.pdf', data: Buffer.from('%PDF-1.4') }]);
    await expect(processFileIsolated(archive, 'zip', 'application/zip', limits))
      .rejects.toThrow(/ARCHIVE_(PATH_TRAVERSAL|CORRUPTED)/);
  });

  it('DOCX estruturalmente válido fica sujeito à conferência', async () => {
    const document = createZipFixture([
      { name: '[Content_Types].xml', data: Buffer.from('<Types/>') },
      { name: 'word/document.xml', data: Buffer.from('<w:document/>') },
    ]);
    const result = await processFileIsolated(
      document,
      'docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      limits,
    );
    expect(result.pageCountMethod).toBe('pending_confirmation');
  });

  it('PPTX válido conta slides, mas continua sujeito à conferência', async () => {
    const presentation = createZipFixture([
      { name: '[Content_Types].xml', data: Buffer.from('<Types/>') },
      { name: 'ppt/presentation.xml', data: Buffer.from('<p:presentation/>') },
      { name: 'ppt/slides/slide1.xml', data: Buffer.from('<p:sld/>') },
      { name: 'ppt/slides/slide2.xml', data: Buffer.from('<p:sld/>') },
    ]);
    const result = await processFileIsolated(
      presentation,
      'pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      limits,
    );
    expect(result.pageCount).toBe(2);
    expect(result.pageCountMethod).toBe('pending_confirmation');
  });

  it('processamento excedendo orçamento de tempo é encerrado', async () => {
    const document = await PDFDocument.create();
    document.addPage();
    const buffer = Buffer.from(await document.save());
    await expect(processFileIsolated(buffer, 'pdf', 'application/pdf', { ...limits, timeoutMs: 1 }))
      .rejects.toThrow('PROCESSING_TIMEOUT');
  });

  it('nome seguro mantém extensão e remove caracteres inadequados', () => {
    const safe = sanitizeFilename('Arte gráfica final.pdf');
    expect(safe).toBe('Arte-grafica-final.pdf');
  });
});
