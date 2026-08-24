import { describe, it, expect } from 'vitest';
import { validateMagicBytes, sanitizeFilename, isExecutable, validateUploadMetadata } from '../../../src/lib/upload/validator';

describe('validateMagicBytes', () => {
  it('PDF válido → valid: true', () => {
    const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x00, 0x00]);
    const res = validateMagicBytes(buffer, 'application/pdf');
    expect(res.valid).toBe(true);
  });

  it('PNG válido → valid: true', () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x00]);
    const res = validateMagicBytes(buffer, 'image/png');
    expect(res.valid).toBe(true);
  });

  it('JPEG válido → valid: true', () => {
    const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0x00]);
    const res = validateMagicBytes(buffer, 'image/jpeg');
    expect(res.valid).toBe(true);
  });

  it('PDF com extensão .png → valid: false', () => {
    // Magic PDF passed as PNG
    const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x00]);
    const res = validateMagicBytes(buffer, 'image/png');
    expect(res.valid).toBe(false);
  });

  it('executável disfarçado de PDF → valid: false', () => {
    const buffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00]); // MZ (exe)
    const res = validateMagicBytes(buffer, 'application/pdf');
    expect(res.valid).toBe(false);
  });

  it('arquivo corrompido → valid: false', () => {
    const buffer = Buffer.from([0x00, 0x00]); // short buffer
    const res = validateMagicBytes(buffer, 'application/pdf');
    expect(res.valid).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('path traversal é rejeitado pelo validador de metadados', () => {
    expect(() => validateUploadMetadata('../../evil.pdf', 'application/pdf')).toThrow('PATH_TRAVERSAL');
    expect(() => validateUploadMetadata('..\\..\\evil.pdf', 'application/pdf')).toThrow('PATH_TRAVERSAL');
  });

  it('caracteres especiais removidos', () => {
    expect(sanitizeFilename('arquivo áéí.pdf')).toBe('arquivo-aei.pdf');
    expect(sanitizeFilename('foto 123@#$%.png')).toBe('foto-123.png');
  });

  it('nome vazio → nome aleatório gerado', () => {
    const name = sanitizeFilename('!!!');
    expect(name.length).toBeGreaterThan(10);
    expect(name).not.toBe('!!!');
  });

  it('nome muito longo → truncado a 200 chars', () => {
    const longName = 'a'.repeat(300) + '.pdf';
    const clean = sanitizeFilename(longName);
    expect(clean.length).toBeLessThanOrEqual(200);
    expect(clean.endsWith('.pdf')).toBe(true);
  });
});

describe('isExecutable', () => {
  it('.exe → true', () => {
    expect(isExecutable('virus.exe')).toBe(true);
  });

  it('.sh → true', () => {
    expect(isExecutable('script.sh')).toBe(true);
  });

  it('.pdf → false', () => {
    expect(isExecutable('document.pdf')).toBe(false);
  });

  it('.docx → false', () => {
    expect(isExecutable('text.docx')).toBe(false);
  });
});
