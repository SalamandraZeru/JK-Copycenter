import type { Json } from '@/types/supabase';
import type { UploadedPdfDimension } from '@/types/pricing';

/**
 * Extracts only processor-produced PDF page-box metadata. Callers must first
 * verify ownership and ready status; browser-provided metadata is never used.
 */
export function extractTrustedPdfDimensions(
  files: Array<{ id: string; processing_metadata: Json }>,
): UploadedPdfDimension[] {
  return files.flatMap((file) => {
    const metadata = file.processing_metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
    const record = metadata as Record<string, Json | undefined>;
    const width = record.pdfPageWidthPoints;
    const height = record.pdfPageHeightPoints;
    if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0
        || typeof height !== 'number' || !Number.isFinite(height) || height <= 0) return [];
    // PDF points are converted to centimetres for comparison with the configured service dimensions.
    return [{ fileId: file.id, widthCm: width * 2.54 / 72, heightCm: height * 2.54 / 72 }];
  });
}
