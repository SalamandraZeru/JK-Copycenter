'use strict';

const path = require('node:path');
const yauzl = require('yauzl');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const { createExtractorFromData } = require('node-unrar-js');

const options = JSON.parse(process.argv[2] || '{}');
const chunks = [];
let inputBytes = 0;

process.stdin.on('data', (chunk) => {
  inputBytes += chunk.length;
  if (inputBytes > options.maxInputBytes) fail('FILE_TOO_LARGE');
  chunks.push(chunk);
});
process.stdin.on('end', async () => {
  try {
    const result = await inspect(Buffer.concat(chunks));
    process.stdout.write(JSON.stringify(result));
  } catch (error) {
    fail(error instanceof Error ? error.message : 'PROCESSING_FAILED');
  }
});

function fail(code) {
  process.stderr.write(String(code).slice(0, 500));
  process.exit(2);
}

function safeEntryName(input) {
  const name = String(input || '').replace(/\\/g, '/');
  if (!name || name.length > 500 || /[\u0000-\u001f\u007f]/.test(name)
      || name.startsWith('/') || /^[A-Za-z]:/.test(name)) throw new Error('ARCHIVE_PATH_TRAVERSAL');
  const parts = name.split('/').filter(Boolean);
  if (parts.some((part) => part === '..' || part === '.')) throw new Error('ARCHIVE_PATH_TRAVERSAL');
  if (parts.length > 12) throw new Error('ARCHIVE_PATH_DEPTH_EXCEEDED');
  return name;
}

function isForbidden(name) {
  const lower = name.toLowerCase();
  return ['.exe','.com','.scr','.bat','.cmd','.sh','.ps1','.js','.mjs','.cjs','.ts','.php','.py',
    '.rb','.pl','.jar','.war','.dll','.so','.dylib','.msi','.vbs','.wsf','.reg','.lnk','.html','.svg']
    .some((extension) => lower.endsWith(extension));
}

function isNestedContainer(name) {
  return /\.(zip|rar|7z|tar|gz|bz2|xz)$/i.test(name);
}

function validateEntryBudget(name, compressedSize, uncompressedSize, totals) {
  safeEntryName(name);
  totals.entries += 1;
  if (totals.entries > options.maxEntries) throw new Error('ARCHIVE_TOO_MANY_ENTRIES');
  if (uncompressedSize < 0 || compressedSize < 0 || uncompressedSize > options.maxUncompressedBytes) {
    throw new Error('ARCHIVE_SIZE_INVALID');
  }
  const ratio = uncompressedSize / Math.max(1, compressedSize);
  if (ratio > options.maxCompressionRatio) throw new Error('ARCHIVE_BOMB_DETECTED');
  totals.uncompressed += uncompressedSize;
  if (totals.uncompressed > options.maxUncompressedBytes) throw new Error('ARCHIVE_TOO_LARGE');
}

function matches(buffer, bytes) {
  return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
}

async function inspectPdf(buffer) {
  try {
    const document = await PDFDocument.load(buffer, { ignoreEncryption: false, updateMetadata: false });
    const pageCount = document.getPageCount();
    if (pageCount < 1 || pageCount > 100000) throw new Error('PDF_PAGE_COUNT_INVALID');
    const firstPage = document.getPage(0);
    const { width, height } = firstPage.getSize();
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width > 10000000 || height > 10000000) {
      throw new Error('PDF_DIMENSIONS_INVALID');
    }
    return { pageCount, pageCountMethod: 'exact', metadata: { pageCount, pdfPageWidthPoints: width, pdfPageHeightPoints: height } };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    throw new Error(message.includes('encrypt') ? 'PDF_ENCRYPTED' : 'PDF_CORRUPTED');
  }
}

async function inspectImage(buffer) {
  const metadata = await sharp(buffer, { limitInputPixels: options.maxImagePixels, failOn: 'warning' }).metadata();
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > options.maxImagePixels) {
    throw new Error('IMAGE_DIMENSIONS_INVALID');
  }
  return {
    pageCount: 1,
    pageCountMethod: 'exact',
    metadata: { width: metadata.width, height: metadata.height, format: metadata.format },
  };
}

function openZip(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (error, zip) => error || !zip ? reject(new Error('ARCHIVE_CORRUPTED')) : resolve(zip));
  });
}

function readZipEntry(zip, entry) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) return reject(new Error('ARCHIVE_ENTRY_READ_FAILED'));
      const parts = [];
      let size = 0;
      stream.on('data', (part) => {
        size += part.length;
        if (size > options.maxEntryBytes) {
          stream.destroy(new Error('ARCHIVE_ENTRY_TOO_LARGE'));
          return;
        }
        parts.push(part);
      });
      stream.on('error', (streamError) => reject(streamError));
      stream.on('end', () => resolve(Buffer.concat(parts)));
    });
  });
}

async function inspectZip(buffer, kind) {
  const zip = await openZip(buffer);
  const totals = { entries: 0, uncompressed: 0 };
  let pages = 0;
  let contentTypes = false;
  let documentXml = false;
  let presentationXml = false;
  let slides = 0;

  return new Promise((resolve, reject) => {
    let settled = false;
    const stop = (error) => {
      if (settled) return;
      settled = true;
      try { zip.close(); } catch {}
      const normalized = error instanceof Error ? error : new Error(String(error));
      if (/invalid relative path|absolute path/i.test(normalized.message)) {
        reject(new Error('ARCHIVE_PATH_TRAVERSAL'));
        return;
      }
      reject(normalized);
    };
    zip.on('error', stop);
    zip.on('entry', async (entry) => {
      try {
        if ((entry.generalPurposeBitFlag & 0x1) !== 0) throw new Error('ARCHIVE_ENCRYPTED');
        const name = safeEntryName(entry.fileName);
        validateEntryBudget(name, entry.compressedSize, entry.uncompressedSize, totals);
        if (/\/$/.test(name)) return zip.readEntry();
        const lower = name.toLowerCase();

        if (kind === 'docx' || kind === 'pptx') {
          if (lower === '[content_types].xml') contentTypes = true;
          if (lower === 'word/document.xml') documentXml = true;
          if (lower === 'ppt/presentation.xml') presentationXml = true;
          if (/^ppt\/slides\/slide[0-9]+\.xml$/.test(lower)) slides += 1;
          if (lower.includes('/embeddings/') || lower.includes('/activex/')
              || lower.endsWith('vbaproject.bin') || isForbidden(lower)) {
            throw new Error('OOXML_ACTIVE_CONTENT');
          }
          zip.readEntry();
          return;
        }

        if (isForbidden(name) || isNestedContainer(name)) throw new Error('ARCHIVE_FORBIDDEN_ENTRY');
        if (!/\.(pdf|docx|pptx|png|jpe?g|webp)$/i.test(name)) throw new Error('ARCHIVE_UNSUPPORTED_ENTRY');
        const entryBuffer = await readZipEntry(zip, entry);
        if (/\.pdf$/i.test(name)) {
          if (!matches(entryBuffer, [0x25,0x50,0x44,0x46,0x2d])) throw new Error('ARCHIVE_DISGUISED_ENTRY');
          pages += (await inspectPdf(entryBuffer)).pageCount;
        } else if (/\.(docx|pptx)$/i.test(name)) {
          if (!matches(entryBuffer, [0x50,0x4b])) throw new Error('ARCHIVE_DISGUISED_ENTRY');
          pages += 1;
        } else {
          const validImage = matches(entryBuffer, [0x89,0x50,0x4e,0x47])
            || matches(entryBuffer, [0xff,0xd8,0xff])
            || (matches(entryBuffer, [0x52,0x49,0x46,0x46])
              && entryBuffer.subarray(8, 12).toString('ascii') === 'WEBP');
          if (!validImage) throw new Error('ARCHIVE_DISGUISED_ENTRY');
          await inspectImage(entryBuffer);
          pages += 1;
        }
        zip.readEntry();
      } catch (error) {
        stop(error);
      }
    });
    zip.on('end', () => {
      if (settled) return;
      settled = true;
      if (kind === 'docx' && (!contentTypes || !documentXml)) {
        return reject(new Error('DOCX_STRUCTURE_INVALID'));
      }
      if (kind === 'pptx' && (!contentTypes || !presentationXml || slides < 1)) {
        return reject(new Error('PPTX_STRUCTURE_INVALID'));
      }
      resolve({
        pageCount: kind === 'pptx' ? slides : Math.max(1, pages),
        pageCountMethod: 'pending_confirmation',
        metadata: { entries: totals.entries, uncompressedBytes: totals.uncompressed, slides },
      });
    });
    zip.readEntry();
  });
}

async function inspectRar(buffer) {
  const data = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const extractor = await createExtractorFromData({ data });
  const list = extractor.getFileList();
  if (list.arcHeader.flags.headerEncrypted) throw new Error('ARCHIVE_ENCRYPTED');
  const totals = { entries: 0, uncompressed: 0 };
  const accepted = [];
  for (const header of list.fileHeaders) {
    validateEntryBudget(header.name, header.packSize, header.unpSize, totals);
    if (header.flags.encrypted) throw new Error('ARCHIVE_ENCRYPTED');
    if (header.flags.directory) continue;
    if (isForbidden(header.name) || isNestedContainer(header.name)) throw new Error('ARCHIVE_FORBIDDEN_ENTRY');
    if (!/\.(pdf|docx|pptx|png|jpe?g|webp)$/i.test(header.name)) throw new Error('ARCHIVE_UNSUPPORTED_ENTRY');
    accepted.push(header.name);
  }
  const extracted = extractor.extract({ files: accepted });
  let pages = 0;
  for (const file of extracted.files) {
    if (!file.extraction) throw new Error('ARCHIVE_ENTRY_READ_FAILED');
    const entryBuffer = Buffer.from(file.extraction);
    const name = file.fileHeader.name;
    if (/\.pdf$/i.test(name)) {
      if (!matches(entryBuffer, [0x25,0x50,0x44,0x46,0x2d])) throw new Error('ARCHIVE_DISGUISED_ENTRY');
      pages += (await inspectPdf(entryBuffer)).pageCount;
    } else if (/\.(docx|pptx)$/i.test(name)) {
      if (!matches(entryBuffer, [0x50,0x4b])) throw new Error('ARCHIVE_DISGUISED_ENTRY');
      pages += 1;
    } else {
      const validImage = matches(entryBuffer, [0x89,0x50,0x4e,0x47])
        || matches(entryBuffer, [0xff,0xd8,0xff])
        || (matches(entryBuffer, [0x52,0x49,0x46,0x46])
          && entryBuffer.subarray(8, 12).toString('ascii') === 'WEBP');
      if (!validImage) throw new Error('ARCHIVE_DISGUISED_ENTRY');
      await inspectImage(entryBuffer);
      pages += 1;
    }
  }
  return {
    pageCount: Math.max(1, pages),
    pageCountMethod: 'pending_confirmation',
    metadata: { entries: totals.entries, uncompressedBytes: totals.uncompressed },
  };
}

async function inspect(buffer) {
  let result;
  if (options.fileType === 'pdf') result = await inspectPdf(buffer);
  else if (options.fileType === 'image') result = await inspectImage(buffer);
  else if (options.fileType === 'rar') result = await inspectRar(buffer);
  else if (['zip', 'docx', 'pptx'].includes(options.fileType)) result = await inspectZip(buffer, options.fileType);
  else throw new Error('UNSUPPORTED_FILE_TYPE');
  return {
    ...result,
    detectedMime: options.canonicalMime,
    fileType: options.fileType,
    isSuspicious: false,
  };
}
