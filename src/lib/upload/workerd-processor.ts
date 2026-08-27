import { PDFDocument } from 'pdf-lib';
import type { FileType, PageCountMethod } from '@/types';

export interface WorkerdProcessingLimits {
  maxInputBytes: number;
  maxEntries: number;
  maxDepth: number;
  maxUncompressedBytes: number;
  maxCompressionRatio: number;
  maxEntryBytes: number;
  maxImagePixels: number;
}

export interface WorkerdProcessingResult {
  pageCount: number;
  pageCountMethod: PageCountMethod;
  detectedMime: string;
  fileType: FileType;
  isSuspicious: boolean;
  metadata: Record<string, string | number | boolean>;
}

interface ZipEntry {
  name: string;
  flags: number;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

interface ArchiveTotals {
  entries: number;
  uncompressed: number;
}

const FORBIDDEN_EXTENSIONS = [
  '.exe', '.com', '.scr', '.bat', '.cmd', '.sh', '.ps1', '.js', '.mjs', '.cjs', '.ts',
  '.php', '.py', '.rb', '.pl', '.jar', '.war', '.dll', '.so', '.dylib', '.msi', '.vbs',
  '.wsf', '.reg', '.lnk', '.html', '.svg',
];

function fail(code: string): never {
  throw new Error(code);
}

function u16(buffer: Buffer, offset: number): number {
  if (offset < 0 || offset + 2 > buffer.length) return fail('ARCHIVE_CORRUPTED');
  return buffer.readUInt16LE(offset);
}

function u32(buffer: Buffer, offset: number): number {
  if (offset < 0 || offset + 4 > buffer.length) return fail('ARCHIVE_CORRUPTED');
  return buffer.readUInt32LE(offset);
}

function hasPrefix(buffer: Buffer, bytes: readonly number[]): boolean {
  return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
}

function safeEntryName(input: string): string {
  const name = input.replace(/\\/g, '/');
  if (!name || name.length > 500 || /[\u0000-\u001f\u007f]/.test(name)
      || name.startsWith('/') || /^[A-Za-z]:/.test(name)) {
    return fail('ARCHIVE_PATH_TRAVERSAL');
  }
  const parts = name.split('/').filter(Boolean);
  if (parts.some((part) => part === '.' || part === '..')) return fail('ARCHIVE_PATH_TRAVERSAL');
  // Match the established Node processor's hard safety limit. The persisted
  // maxDepth setting controls recursive processing elsewhere and must not
  // reject ordinary OOXML paths such as word/document.xml.
  if (parts.length > 12) return fail('ARCHIVE_PATH_DEPTH_EXCEEDED');
  return name;
}

function isForbidden(name: string): boolean {
  const lower = name.toLowerCase();
  return FORBIDDEN_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function isNestedContainer(name: string): boolean {
  return /\.(zip|rar|7z|tar|gz|bz2|xz)$/i.test(name);
}

function validateEntryBudget(entry: ZipEntry, totals: ArchiveTotals, limits: WorkerdProcessingLimits): void {
  safeEntryName(entry.name);
  totals.entries += 1;
  if (totals.entries > limits.maxEntries) fail('ARCHIVE_TOO_MANY_ENTRIES');
  if (entry.uncompressedSize < 0 || entry.compressedSize < 0
      || entry.uncompressedSize > limits.maxUncompressedBytes) {
    fail('ARCHIVE_SIZE_INVALID');
  }
  if (entry.uncompressedSize / Math.max(1, entry.compressedSize) > limits.maxCompressionRatio) {
    fail('ARCHIVE_BOMB_DETECTED');
  }
  totals.uncompressed += entry.uncompressedSize;
  if (totals.uncompressed > limits.maxUncompressedBytes) fail('ARCHIVE_TOO_LARGE');
}

function samePdfBox(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean {
  const tolerance = 0.01;
  return Math.abs(left.x - right.x) <= tolerance
    && Math.abs(left.y - right.y) <= tolerance
    && Math.abs(left.width - right.width) <= tolerance
    && Math.abs(left.height - right.height) <= tolerance;
}

function boxContains(
  outer: { x: number; y: number; width: number; height: number },
  inner: { x: number; y: number; width: number; height: number },
): boolean {
  const tolerance = 0.01;
  return inner.x >= outer.x - tolerance
    && inner.y >= outer.y - tolerance
    && inner.x + inner.width <= outer.x + outer.width + tolerance
    && inner.y + inner.height <= outer.y + outer.height + tolerance;
}

async function inspectPdf(buffer: Buffer): Promise<{ pageCount: number; pageCountMethod: PageCountMethod; metadata: Record<string, number | boolean> }> {
  try {
    const document = await PDFDocument.load(buffer, { ignoreEncryption: false, updateMetadata: false });
    const pageCount = document.getPageCount();
    if (pageCount < 1 || pageCount > 100_000) fail('PDF_PAGE_COUNT_INVALID');
    const firstPage = document.getPage(0);
    const { width, height } = firstPage.getSize();
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 10_000_000 || height > 10_000_000) {
      fail('PDF_DIMENSIONS_INVALID');
    }
    // Fonts, resolution, colour spaces and transparency require a dedicated
    // graphics engine. The structural checks below are deterministic and the
    // remaining graphic review is explicitly marked as manual.
    const analysedPages = Math.min(pageCount, 1_000);
    let mediaBoxesConsistent = true;
    let orientationsConsistent = true;
    let boxesInsideMedia = true;
    let hasDistinctTrimBox = false;
    let hasDistinctBleedBox = false;
    let referenceOrientation: 'portrait' | 'landscape' | null = null;
    for (let index = 0; index < analysedPages; index += 1) {
      const page = document.getPage(index);
      const media = page.getMediaBox();
      const trim = page.getTrimBox();
      const bleed = page.getBleedBox();
      const orientation = media.width >= media.height ? 'landscape' : 'portrait';
      if (index > 0 && (Math.abs(media.width - width) > 0.01 || Math.abs(media.height - height) > 0.01)) {
        mediaBoxesConsistent = false;
      }
      if (referenceOrientation && referenceOrientation !== orientation) orientationsConsistent = false;
      referenceOrientation ||= orientation;
      if (!boxContains(media, trim) || !boxContains(media, bleed)) boxesInsideMedia = false;
      if (!samePdfBox(trim, media)) hasDistinctTrimBox = true;
      if (!samePdfBox(bleed, trim)) hasDistinctBleedBox = true;
    }
    return {
      pageCount,
      pageCountMethod: 'exact',
      metadata: {
        pageCount,
        pdfPageWidthPoints: width,
        pdfPageHeightPoints: height,
        pdfPagesAnalysed: analysedPages,
        pdfStructureComplete: analysedPages === pageCount,
        pdfMediaBoxesConsistent: mediaBoxesConsistent,
        pdfOrientationsConsistent: orientationsConsistent,
        pdfBoxesInsideMedia: boxesInsideMedia,
        pdfHasDistinctTrimBox: hasDistinctTrimBox,
        pdfHasDistinctBleedBox: hasDistinctBleedBox,
        pdfGraphicChecksRequireManualReview: true,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    return fail(message.includes('encrypt') ? 'PDF_ENCRYPTED' : 'PDF_CORRUPTED');
  }
}

function validateImageDimensions(width: number, height: number, format: string, maxPixels: number) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
      || width * height > maxPixels) {
    return fail('IMAGE_DIMENSIONS_INVALID');
  }
  return {
    pageCount: 1,
    pageCountMethod: 'exact' as PageCountMethod,
    metadata: { width, height, format },
  };
}

function inspectJpeg(buffer: Buffer, maxPixels: number) {
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return fail('IMAGE_CORRUPTED');
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    if (marker === undefined) return fail('IMAGE_CORRUPTED');
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9) continue;
    const length = u16(buffer, offset);
    if (length < 2 || offset + length > buffer.length) return fail('IMAGE_CORRUPTED');
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof) {
      if (length < 8) return fail('IMAGE_CORRUPTED');
      return validateImageDimensions(u16(buffer, offset + 5), u16(buffer, offset + 3), 'jpeg', maxPixels);
    }
    offset += length;
  }
  return fail('IMAGE_CORRUPTED');
}

function inspectWebp(buffer: Buffer, maxPixels: number) {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const kind = buffer.subarray(offset, offset + 4).toString('ascii');
    const size = u32(buffer, offset + 4);
    const data = offset + 8;
    if (data + size > buffer.length) return fail('IMAGE_CORRUPTED');
    if (kind === 'VP8X' && size >= 10) {
      const width = 1 + buffer.readUIntLE(data + 4, 3);
      const height = 1 + buffer.readUIntLE(data + 7, 3);
      return validateImageDimensions(width, height, 'webp', maxPixels);
    }
    if (kind === 'VP8 ' && size >= 10 && buffer.subarray(data + 3, data + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
      const width = buffer.readUInt16LE(data + 6) & 0x3fff;
      const height = buffer.readUInt16LE(data + 8) & 0x3fff;
      return validateImageDimensions(width, height, 'webp', maxPixels);
    }
    if (kind === 'VP8L' && size >= 5 && buffer[data] === 0x2f) {
      const b0 = buffer[data + 1] ?? 0;
      const b1 = buffer[data + 2] ?? 0;
      const b2 = buffer[data + 3] ?? 0;
      const b3 = buffer[data + 4] ?? 0;
      const width = 1 + b0 + ((b1 & 0x3f) << 8);
      const height = 1 + (b1 >> 6) + (b2 << 2) + ((b3 & 0x0f) << 10);
      return validateImageDimensions(width, height, 'webp', maxPixels);
    }
    offset = data + size + (size % 2);
  }
  return fail('IMAGE_CORRUPTED');
}

function inspectImage(buffer: Buffer, maxPixels: number) {
  if (hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47])) {
    if (buffer.length < 24 || buffer.subarray(12, 16).toString('ascii') !== 'IHDR') return fail('IMAGE_CORRUPTED');
    return validateImageDimensions(buffer.readUInt32BE(16), buffer.readUInt32BE(20), 'png', maxPixels);
  }
  if (hasPrefix(buffer, [0xff, 0xd8, 0xff])) return inspectJpeg(buffer, maxPixels);
  if (hasPrefix(buffer, [0x52, 0x49, 0x46, 0x46]) && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return inspectWebp(buffer, maxPixels);
  }
  return fail('IMAGE_CORRUPTED');
}

function findZipEnd(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (u32(buffer, offset) === 0x06054b50 && offset + 22 + u16(buffer, offset + 20) === buffer.length) {
      return offset;
    }
  }
  return fail('ARCHIVE_CORRUPTED');
}

function readZipEntries(buffer: Buffer): ZipEntry[] {
  const end = findZipEnd(buffer);
  if (u16(buffer, end + 4) !== 0 || u16(buffer, end + 6) !== 0) fail('ARCHIVE_MULTIDISK_UNSUPPORTED');
  const entryCount = u16(buffer, end + 10);
  const directorySize = u32(buffer, end + 12);
  const directoryOffset = u32(buffer, end + 16);
  if (entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff
      || directoryOffset + directorySize > end) {
    fail('ARCHIVE_ZIP64_UNSUPPORTED');
  }
  const entries: ZipEntry[] = [];
  let offset = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (u32(buffer, offset) !== 0x02014b50) fail('ARCHIVE_CORRUPTED');
    const nameLength = u16(buffer, offset + 28);
    const extraLength = u16(buffer, offset + 30);
    const commentLength = u16(buffer, offset + 32);
    const nameEnd = offset + 46 + nameLength;
    if (nameEnd > directoryOffset + directorySize) fail('ARCHIVE_CORRUPTED');
    const name = buffer.subarray(offset + 46, nameEnd).toString('utf8');
    entries.push({
      name,
      flags: u16(buffer, offset + 8),
      compressionMethod: u16(buffer, offset + 10),
      compressedSize: u32(buffer, offset + 20),
      uncompressedSize: u32(buffer, offset + 24),
      localHeaderOffset: u32(buffer, offset + 42),
    });
    offset = nameEnd + extraLength + commentLength;
  }
  if (offset !== directoryOffset + directorySize) fail('ARCHIVE_CORRUPTED');
  return entries;
}

async function inflateRaw(compressed: Buffer, maxBytes: number): Promise<Buffer> {
  const stream = new Blob([new Uint8Array(compressed)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        fail('ARCHIVE_ENTRY_TOO_LARGE');
      }
      parts.push(value);
    }
  } catch {
    return fail('ARCHIVE_ENTRY_READ_FAILED');
  }
  return Buffer.concat(parts.map((part) => Buffer.from(part)));
}

async function readZipEntry(buffer: Buffer, entry: ZipEntry, limits: WorkerdProcessingLimits): Promise<Buffer> {
  const offset = entry.localHeaderOffset;
  if (u32(buffer, offset) !== 0x04034b50) return fail('ARCHIVE_CORRUPTED');
  const nameLength = u16(buffer, offset + 26);
  const extraLength = u16(buffer, offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (start < 0 || end > buffer.length) return fail('ARCHIVE_CORRUPTED');
  const compressed = buffer.subarray(start, end);
  const content = entry.compressionMethod === 0
    ? Buffer.from(compressed)
    : entry.compressionMethod === 8
      ? await inflateRaw(compressed, limits.maxEntryBytes)
      : fail('ARCHIVE_COMPRESSION_UNSUPPORTED');
  if (content.length !== entry.uncompressedSize || content.length > limits.maxEntryBytes) {
    return fail('ARCHIVE_ENTRY_TOO_LARGE');
  }
  return content;
}

async function inspectZip(buffer: Buffer, fileType: Extract<FileType, 'zip' | 'docx' | 'pptx'>, limits: WorkerdProcessingLimits) {
  const totals: ArchiveTotals = { entries: 0, uncompressed: 0 };
  let pages = 0;
  let contentTypes = false;
  let documentXml = false;
  let presentationXml = false;
  let slides = 0;

  for (const entry of readZipEntries(buffer)) {
    if ((entry.flags & 0x1) !== 0) fail('ARCHIVE_ENCRYPTED');
    const name = safeEntryName(entry.name);
    validateEntryBudget(entry, totals, limits);
    if (name.endsWith('/')) continue;
    const lower = name.toLowerCase();

    if (fileType === 'docx' || fileType === 'pptx') {
      if (lower === '[content_types].xml') contentTypes = true;
      if (lower === 'word/document.xml') documentXml = true;
      if (lower === 'ppt/presentation.xml') presentationXml = true;
      if (/^ppt\/slides\/slide[0-9]+\.xml$/.test(lower)) slides += 1;
      if (lower.includes('/embeddings/') || lower.includes('/activex/')
          || lower.endsWith('vbaproject.bin') || isForbidden(lower)) {
        fail('OOXML_ACTIVE_CONTENT');
      }
      continue;
    }

    if (isForbidden(name) || isNestedContainer(name)) fail('ARCHIVE_FORBIDDEN_ENTRY');
    if (!/\.(pdf|docx|pptx|png|jpe?g|webp)$/i.test(name)) fail('ARCHIVE_UNSUPPORTED_ENTRY');
    const content = await readZipEntry(buffer, entry, limits);
    if (/\.pdf$/i.test(name)) {
      if (!hasPrefix(content, [0x25, 0x50, 0x44, 0x46, 0x2d])) fail('ARCHIVE_DISGUISED_ENTRY');
      pages += (await inspectPdf(content)).pageCount;
    } else if (/\.(docx|pptx)$/i.test(name)) {
      if (!hasPrefix(content, [0x50, 0x4b])) fail('ARCHIVE_DISGUISED_ENTRY');
      pages += 1;
    } else {
      inspectImage(content, limits.maxImagePixels);
      pages += 1;
    }
  }

  if (fileType === 'docx' && (!contentTypes || !documentXml)) fail('DOCX_STRUCTURE_INVALID');
  if (fileType === 'pptx' && (!contentTypes || !presentationXml || slides < 1)) fail('PPTX_STRUCTURE_INVALID');
  return {
    pageCount: fileType === 'pptx' ? slides : Math.max(1, pages),
    pageCountMethod: 'pending_confirmation' as PageCountMethod,
    metadata: { entries: totals.entries, uncompressedBytes: totals.uncompressed, slides },
  };
}

export async function processFileInWorkerd(
  buffer: Buffer,
  fileType: FileType,
  canonicalMime: string,
  limits: WorkerdProcessingLimits,
): Promise<WorkerdProcessingResult> {
  if (buffer.length > limits.maxInputBytes) fail('FILE_TOO_LARGE');
  let result: { pageCount: number; pageCountMethod: PageCountMethod; metadata: Record<string, string | number | boolean> };
  if (fileType === 'pdf') result = await inspectPdf(buffer);
  else if (fileType === 'image') result = inspectImage(buffer, limits.maxImagePixels);
  else if (fileType === 'rar') fail('RAR_PROCESSING_UNAVAILABLE');
  else result = await inspectZip(buffer, fileType, limits);
  return {
    ...result,
    detectedMime: canonicalMime,
    fileType,
    isSuspicious: false,
    metadata: { ...result.metadata, processor: 'workerd_in_process' },
  };
}
