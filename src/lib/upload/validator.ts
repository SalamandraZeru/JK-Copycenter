import crypto from 'crypto';
import path from 'path';
import type { FileType } from '@/types/index';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  detectedMime: string;
  detectedType: FileType;
}

export interface UploadMetadataValidation {
  originalName: string;
  safeName: string;
  declaredMime: string;
  fileType: FileType;
}

const MIME_RULES: Record<string, { type: FileType; extensions: readonly string[] }> = {
  'application/pdf': { type: 'pdf', extensions: ['.pdf'] },
  'image/png': { type: 'image', extensions: ['.png'] },
  'image/jpeg': { type: 'image', extensions: ['.jpg', '.jpeg'] },
  'image/webp': { type: 'image', extensions: ['.webp'] },
  'application/zip': { type: 'zip', extensions: ['.zip'] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    type: 'docx', extensions: ['.docx'],
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    type: 'pptx', extensions: ['.pptx'],
  },
  'application/vnd.rar': { type: 'rar', extensions: ['.rar'] },
  'application/x-rar-compressed': { type: 'rar', extensions: ['.rar'] },
};

const MAGIC_BYTES: Partial<Record<FileType | 'png' | 'jpeg' | 'webp', readonly number[]>> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2D],
  png: [0x89, 0x50, 0x4E, 0x47],
  jpeg: [0xFF, 0xD8, 0xFF],
  webp: [0x52, 0x49, 0x46, 0x46],
  zip: [0x50, 0x4B],
  docx: [0x50, 0x4B],
  pptx: [0x50, 0x4B],
  rar: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07],
};

function startsWith(buffer: Buffer, signature: readonly number[]): boolean {
  return buffer.length >= signature.length
    && signature.every((byte, index) => buffer[index] === byte);
}

export function validateUploadMetadata(
  originalNameInput: string,
  declaredMimeInput: string,
): UploadMetadataValidation {
  const originalName = originalNameInput.normalize('NFC').trim();
  const declaredMime = declaredMimeInput.trim().toLowerCase();
  const rule = MIME_RULES[declaredMime];
  if (!rule) throw new Error('UNSUPPORTED_FILE_TYPE');
  if (!originalName || originalName.length > 200 || /[\u0000-\u001f\u007f]/.test(originalName)) {
    throw new Error('UNSAFE_FILENAME');
  }
  if (originalName.includes('/') || originalName.includes('\\')
      || path.basename(originalName) !== originalName || originalName === '.' || originalName === '..') {
    throw new Error('PATH_TRAVERSAL');
  }
  const extension = path.extname(originalName).toLowerCase();
  if (!rule.extensions.includes(extension)) throw new Error('EXTENSION_MIME_MISMATCH');
  return {
    originalName,
    safeName: sanitizeFilename(originalName),
    declaredMime,
    fileType: rule.type,
  };
}

export function validateMagicBytes(buffer: Buffer, declaredMimeInput: string): FileValidationResult {
  const declaredMime = declaredMimeInput.trim().toLowerCase();
  const rule = MIME_RULES[declaredMime];
  if (!rule) {
    return { valid: false, error: 'UNSUPPORTED_FILE_TYPE', detectedMime: '', detectedType: 'pdf' };
  }

  let signatureKey: FileType | 'png' | 'jpeg' | 'webp' = rule.type;
  if (declaredMime === 'image/png') signatureKey = 'png';
  if (declaredMime === 'image/jpeg') signatureKey = 'jpeg';
  if (declaredMime === 'image/webp') signatureKey = 'webp';
  const signature = MAGIC_BYTES[signatureKey];
  if (!signature || !startsWith(buffer, signature)) {
    return {
      valid: false,
      error: 'INVALID_MAGIC_BYTES',
      detectedMime: '',
      detectedType: rule.type,
    };
  }

  if (declaredMime === 'image/webp') {
    const isWebp = buffer.length >= 12 && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    if (!isWebp) {
      return { valid: false, error: 'INVALID_MAGIC_BYTES', detectedMime: '', detectedType: rule.type };
    }
  }

  return { valid: true, detectedMime: declaredMime, detectedType: rule.type };
}

export function sanitizeFilename(name: string): string {
  const extension = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, '');
  const base = path.basename(name, path.extname(name))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, Math.max(1, 180 - extension.length));
  return `${base || crypto.randomUUID()}${extension}`.slice(0, 200);
}

export function isExecutable(filename: string): boolean {
  const forbiddenExtensions = [
    '.exe', '.com', '.scr', '.bat', '.cmd', '.sh', '.bash', '.ps1',
    '.py', '.rb', '.pl', '.php', '.js', '.ts', '.mjs', '.cjs',
    '.jar', '.war', '.app', '.dmg', '.pkg', '.deb', '.rpm', '.msi',
    '.vbs', '.wsf', '.reg', '.lnk', '.dll', '.so', '.dylib', '.html', '.svg',
  ];
  const lowerName = filename.toLowerCase();
  return forbiddenExtensions.some((extension) => lowerName.endsWith(extension));
}

export function canonicalMimeForType(fileType: FileType, declaredMime: string): string {
  if (fileType === 'rar') return 'application/vnd.rar';
  return declaredMime;
}
