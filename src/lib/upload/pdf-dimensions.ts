import type { Json } from '@/types/supabase';
import type { PdfDimensionAssessment, UploadedPdfDimension } from '@/types/pricing';

interface PdfMetadataFile {
  id: string;
  mime_type?: string | null;
  detected_mime_type?: string | null;
  processing_metadata: Json;
}

function record(value: Json): Record<string, Json | undefined> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : null;
}

function boolean(value: Json | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function positiveNumber(value: Json | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function wholeNumber(value: Json | undefined): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function assessment(
  status: PdfDimensionAssessment['status'],
  fileCount: number,
  dimension: UploadedPdfDimension | null = null,
): PdfDimensionAssessment {
  return {
    status,
    policy: 'media_box_single_page',
    fileCount,
    dimension,
  };
}

/**
 * Applies the Stage 2 large-format policy. The MediaBox of a single-page PDF
 * is the only automatic source of physical dimensions. A distinct TrimBox or
 * BleedBox is not substituted here: those remain prepress information.
 */
export function assessPdfDimensionsForAutomaticQuote(
  files: readonly PdfMetadataFile[],
): PdfDimensionAssessment {
  if (files.length === 0) return assessment('missing_file', 0);
  if (files.length !== 1) return assessment('multiple_files', files.length);

  const file = files[0]!;
  const detectedMime = file.detected_mime_type ?? file.mime_type;
  if (detectedMime !== 'application/pdf') return assessment('file_not_pdf', 1);

  const metadata = record(file.processing_metadata);
  if (!metadata) return assessment('metadata_unavailable', 1);

  const pageCount = wholeNumber(metadata.pageCount);
  if (pageCount === null) return assessment('metadata_unavailable', 1);
  if (pageCount !== 1) return assessment('multiple_pages', 1);

  const structureComplete = boolean(metadata.pdfStructureComplete);
  const mediaBoxesConsistent = boolean(metadata.pdfMediaBoxesConsistent);
  const orientationsConsistent = boolean(metadata.pdfOrientationsConsistent);
  const boxesInsideMedia = boolean(metadata.pdfBoxesInsideMedia);
  if (structureComplete !== true || mediaBoxesConsistent !== true
      || orientationsConsistent !== true || boxesInsideMedia !== true) {
    return assessment('inconsistent_media_box', 1);
  }

  const widthPoints = positiveNumber(metadata.pdfPageWidthPoints);
  const heightPoints = positiveNumber(metadata.pdfPageHeightPoints);
  if (widthPoints === null || heightPoints === null) return assessment('metadata_unavailable', 1);

  return assessment('trusted', 1, {
    fileId: file.id,
    widthCm: widthPoints * 2.54 / 72,
    heightCm: heightPoints * 2.54 / 72,
    source: 'media_box',
  });
}
