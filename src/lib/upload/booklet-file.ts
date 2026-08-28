import type { BookletFileAssessment } from '@/types/pricing';

interface BookletMetadataFile {
  mime_type?: string | null;
  detected_mime_type?: string | null;
  page_count: number;
  page_count_method: 'exact' | 'estimated' | 'pending_confirmation';
}

/**
 * A booklet is quoted automatically only from one complete, server-checked
 * PDF. Separate cover files and non-PDF source material need prepress review:
 * their page sequence and imposition cannot be inferred safely by the cart.
 */
export function assessBookletFileForAutomaticQuote(
  files: readonly BookletMetadataFile[],
): BookletFileAssessment {
  if (files.length === 0) return { status: 'missing_file', fileCount: 0, pageCount: null };
  if (files.length !== 1) return { status: 'multiple_files', fileCount: files.length, pageCount: null };

  const file = files[0]!;
  const detectedMime = file.detected_mime_type ?? file.mime_type;
  if (detectedMime !== 'application/pdf') return { status: 'file_not_pdf', fileCount: 1, pageCount: null };
  if (file.page_count_method !== 'exact' || !Number.isSafeInteger(file.page_count) || file.page_count < 1) {
    return { status: 'page_count_unconfirmed', fileCount: 1, pageCount: null };
  }
  return { status: 'trusted', fileCount: 1, pageCount: file.page_count };
}
