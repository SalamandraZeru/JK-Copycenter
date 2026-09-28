import type { PricingProfile, PricingProfileConfig } from '@/types/pricing';
import type { GraphicQuoteTechnicalRequirements } from '@/types/service';

interface TechnicalFile {
  page_count: number;
  page_count_method: 'exact' | 'estimated' | 'pending_confirmation';
  mime_type: string | null;
  detected_mime_type: string | null;
}

interface TechnicalInput {
  files: readonly TechnicalFile[];
  dimensions: {
    widthCm?: number | undefined;
    heightCm?: number | undefined;
    lengthCm?: number | undefined;
  };
  bookletPaddingApproved: boolean;
  artworkBleedAcknowledged: boolean;
}

function copyDefined<T extends object, K extends keyof T>(
  target: T,
  source: T,
  keys: readonly K[],
): void {
  for (const key of keys) {
    if (source[key] !== undefined) target[key] = source[key];
  }
}

export function graphicQuoteTechnicalRequirements(
  profile: PricingProfile,
  config: PricingProfileConfig,
): GraphicQuoteTechnicalRequirements {
  const requirements: GraphicQuoteTechnicalRequirements = {
    kind: profile === 'booklet_imposition'
      ? 'booklet'
      : profile === 'per_square_meter'
        ? 'square_meter'
        : profile === 'per_linear_meter'
          ? 'linear_meter'
          : profile === 'per_print_run'
            ? 'print_run'
            : 'standard',
    requireCompleteCompatibility: config.requireCompleteCompatibility === true,
  };

  copyDefined(requirements, config as GraphicQuoteTechnicalRequirements, [
    'minPages',
    'maxPages',
    'pageMultiple',
    'allowBlankPagePadding',
    'requiresCustomerApprovalForPadding',
    'minWidthCm',
    'maxWidthCm',
    'minHeightCm',
    'maxHeightCm',
    'validateUploadedPdfDimensions',
    'requiresArtworkBleedAcknowledgement',
  ]);
  return requirements;
}

function outside(value: number, minimum?: number, maximum?: number): boolean {
  return (minimum !== undefined && value < minimum)
    || (maximum !== undefined && value > maximum);
}

/**
 * Validates only production feasibility. It deliberately performs no monetary
 * calculation and must run after upload ownership/status checks.
 */
export function validateGraphicQuoteTechnicalInput(
  requirements: GraphicQuoteTechnicalRequirements,
  input: TechnicalInput,
): void {
  const pageCount = input.files.reduce((total, file) => total + Math.max(1, file.page_count), 0);
  if (outside(pageCount, requirements.minPages, requirements.maxPages)) {
    throw new Error('SERVICE_PAGE_COUNT_OUT_OF_RANGE');
  }

  if (requirements.kind === 'booklet') {
    if (input.files.length !== 1) throw new Error('BOOKLET_SINGLE_PDF_REQUIRED');
    const file = input.files[0]!;
    const detectedMime = file.detected_mime_type || file.mime_type;
    if (detectedMime !== 'application/pdf' || file.page_count_method !== 'exact') {
      throw new Error('BOOKLET_EXACT_PDF_REQUIRED');
    }
    const multiple = requirements.pageMultiple ?? 4;
    if (pageCount % multiple !== 0) {
      if (!requirements.allowBlankPagePadding) throw new Error('BOOKLET_PAGE_MULTIPLE_REQUIRED');
      if (requirements.requiresCustomerApprovalForPadding && !input.bookletPaddingApproved) {
        throw new Error('BOOKLET_PADDING_APPROVAL_REQUIRED');
      }
    }
  }

  if (requirements.kind === 'square_meter') {
    const { widthCm, heightCm } = input.dimensions;
    if (!widthCm || !heightCm) throw new Error('SERVICE_DIMENSIONS_REQUIRED');
    if (outside(widthCm, requirements.minWidthCm, requirements.maxWidthCm)
        || outside(heightCm, requirements.minHeightCm, requirements.maxHeightCm)) {
      throw new Error('SERVICE_DIMENSIONS_OUT_OF_RANGE');
    }
  }

  if (requirements.kind === 'linear_meter') {
    if (!input.dimensions.lengthCm) throw new Error('SERVICE_LENGTH_REQUIRED');
  }

  if (requirements.kind === 'print_run'
      && requirements.requiresArtworkBleedAcknowledgement
      && !input.artworkBleedAcknowledged) {
    throw new Error('ARTWORK_BLEED_ACKNOWLEDGEMENT_REQUIRED');
  }
}
