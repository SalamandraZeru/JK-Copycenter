import type { Json } from '@/types/supabase';
import type { PricingProfile, PricingProfileConfig } from '@/types/pricing';

const profiles: PricingProfile[] = [
  'per_page',
  'per_item',
  'per_print_run',
  'per_sheet',
  'per_square_meter',
  'per_linear_meter',
  'binding_by_file_pages',
  'booklet_imposition',
  'manual_quote',
];

export function isPricingProfile(value: string): value is PricingProfile {
  return profiles.includes(value as PricingProfile);
}

function record(value: Json): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {};
}

function isRecord(value: Json): value is Record<string, Json | undefined> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function integer(value: Json | undefined, minimum: number, maximum: number): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return undefined;
  return value >= minimum && value <= maximum ? value : undefined;
}

function boolean(value: Json | undefined): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function centimeters(value: Json | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100_000) return undefined;
  const hundredths = Math.round(value * 100);
  return Number.isSafeInteger(hundredths) && Math.abs(hundredths / 100 - value) < 0.000_001
    ? hundredths / 100
    : undefined;
}

function nonNegativeInteger(value: Json | undefined, maximum: number): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) return undefined;
  return value;
}

function fieldKey(value: Json | undefined): string | undefined {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]*$/.test(value) ? value : undefined;
}

function fieldKeys(value: Json | undefined): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const keys = value.map((entry) => fieldKey(entry));
  if (keys.some((key) => key === undefined)) return undefined;
  const normalized = keys as string[];
  return new Set(normalized).size === normalized.length ? normalized : undefined;
}

function pdfDimensionPolicy(value: Json | undefined): PricingProfileConfig['pdfDimensionPolicy'] | undefined {
  return value === 'media_box_single_page' ? value : undefined;
}

/** Normalizes only safe, non-commercial technical limits from the catalog. */
export function normalizePricingProfileConfig(value: Json): PricingProfileConfig {
  const source = record(value);
  const pagesPerSheet = integer(source.pages_per_sheet, 1, 1_000);
  const minPages = integer(source.min_pages, 1, 1_000_000);
  const maxPages = integer(source.max_pages, 1, 1_000_000);
  const pageMultiple = integer(source.page_multiple, 2, 1_000);
  const allowBlankPagePadding = boolean(source.allow_blank_page_padding);
  const requiresCustomerApprovalForPadding = boolean(source.requires_customer_approval_for_padding);
  const requireCompleteCompatibility = boolean(source.require_complete_compatibility);
  const minWidthCm = centimeters(source.min_width_cm);
  const maxWidthCm = centimeters(source.max_width_cm);
  const minHeightCm = centimeters(source.min_height_cm);
  const maxHeightCm = centimeters(source.max_height_cm);
  const minimumBillableAreaCm2 = nonNegativeInteger(source.minimum_billable_area_cm2, 1_000_000_000);
  const wasteMarginBps = nonNegativeInteger(source.waste_margin_bps, 100_000);
  const validateUploadedPdfDimensions = boolean(source.validate_uploaded_pdf_dimensions);
  const dimensionPolicy = pdfDimensionPolicy(source.pdf_dimension_policy);
  const pdfDimensionToleranceBps = nonNegativeInteger(source.pdf_dimension_tolerance_bps, 10_000);
  const runFieldKey = fieldKey(source.run_field_key);
  const productionLeadTimeBusinessDays = integer(source.production_lead_time_business_days, 1, 365);
  const requiresArtworkFile = boolean(source.requires_artwork_file);
  const requiresArtworkBleedAcknowledgement = boolean(source.requires_artwork_bleed_acknowledgement);
  const bookletCoreFieldKeys = fieldKeys(source.booklet_core_field_keys);
  const bookletCoverFieldKeys = fieldKeys(source.booklet_cover_field_keys);
  const bookletFinishingFieldKeys = fieldKeys(source.booklet_finishing_field_keys);
  const bookletCoverPages = integer(source.booklet_cover_pages, 1, 32);

  const normalized: PricingProfileConfig = {};
  if (pagesPerSheet !== undefined) normalized.pagesPerSheet = pagesPerSheet;
  if (minPages !== undefined) normalized.minPages = minPages;
  if (maxPages !== undefined && (minPages === undefined || maxPages >= minPages)) normalized.maxPages = maxPages;
  if (pageMultiple !== undefined) normalized.pageMultiple = pageMultiple;
  if (allowBlankPagePadding !== undefined) normalized.allowBlankPagePadding = allowBlankPagePadding;
  if (requiresCustomerApprovalForPadding !== undefined) normalized.requiresCustomerApprovalForPadding = requiresCustomerApprovalForPadding;
  if (requireCompleteCompatibility !== undefined) normalized.requireCompleteCompatibility = requireCompleteCompatibility;
  if (minWidthCm !== undefined) normalized.minWidthCm = minWidthCm;
  if (maxWidthCm !== undefined && (minWidthCm === undefined || maxWidthCm >= minWidthCm)) normalized.maxWidthCm = maxWidthCm;
  if (minHeightCm !== undefined) normalized.minHeightCm = minHeightCm;
  if (maxHeightCm !== undefined && (minHeightCm === undefined || maxHeightCm >= minHeightCm)) normalized.maxHeightCm = maxHeightCm;
  if (minimumBillableAreaCm2 !== undefined) normalized.minimumBillableAreaCm2 = minimumBillableAreaCm2;
  if (wasteMarginBps !== undefined) normalized.wasteMarginBps = wasteMarginBps;
  if (validateUploadedPdfDimensions !== undefined) normalized.validateUploadedPdfDimensions = validateUploadedPdfDimensions;
  if (dimensionPolicy !== undefined) normalized.pdfDimensionPolicy = dimensionPolicy;
  if (pdfDimensionToleranceBps !== undefined) normalized.pdfDimensionToleranceBps = pdfDimensionToleranceBps;
  if (runFieldKey !== undefined) normalized.runFieldKey = runFieldKey;
  if (productionLeadTimeBusinessDays !== undefined) normalized.productionLeadTimeBusinessDays = productionLeadTimeBusinessDays;
  if (requiresArtworkFile !== undefined) normalized.requiresArtworkFile = requiresArtworkFile;
  if (requiresArtworkBleedAcknowledgement !== undefined) {
    normalized.requiresArtworkBleedAcknowledgement = requiresArtworkBleedAcknowledgement;
  }
  if (bookletCoreFieldKeys !== undefined) normalized.bookletCoreFieldKeys = bookletCoreFieldKeys;
  if (bookletCoverFieldKeys !== undefined) normalized.bookletCoverFieldKeys = bookletCoverFieldKeys;
  if (bookletFinishingFieldKeys !== undefined) normalized.bookletFinishingFieldKeys = bookletFinishingFieldKeys;
  if (bookletCoverPages !== undefined) normalized.bookletCoverPages = bookletCoverPages;
  return normalized;
}

/**
 * Reject malformed technical settings before they reach the published catalog.
 * Commercial rates still live in the service price and price-rule records.
 */
export function validatePricingProfileConfig(profile: PricingProfile, value: Json): string[] {
  if (!isRecord(value)) return ['A configuração técnica do perfil deve ser um objeto JSON.'];

  const normalized = normalizePricingProfileConfig(value);
  const errors: string[] = [];
  if (profile === 'per_sheet' && normalized.pagesPerSheet === undefined) {
    errors.push('Informe quantas páginas cabem em cada folha física.');
  }
  if (profile === 'booklet_imposition') {
    if (normalized.pageMultiple === undefined) errors.push('Informe o múltiplo de páginas do livreto.');
    if (normalized.minPages === undefined) errors.push('Informe o mínimo de páginas do livreto.');
    if (normalized.allowBlankPagePadding === undefined) errors.push('Defina se o livreto permite páginas técnicas em branco.');
    if (normalized.requiresCustomerApprovalForPadding === undefined) errors.push('Defina se a complementação exige aprovação do cliente.');
    if (normalized.bookletCoreFieldKeys === undefined) errors.push('Classifique os campos que compõem o miolo do livreto.');
    if (normalized.bookletCoverFieldKeys === undefined) errors.push('Classifique os campos que compõem a capa do livreto.');
    if (normalized.bookletFinishingFieldKeys === undefined) errors.push('Classifique os campos que compõem o acabamento do livreto.');
    if (normalized.bookletCoverPages === undefined) errors.push('Informe a quantidade de páginas de capa usada nos adicionais por página.');
    const bookletFieldKeys = [
      ...(normalized.bookletCoreFieldKeys ?? []),
      ...(normalized.bookletCoverFieldKeys ?? []),
      ...(normalized.bookletFinishingFieldKeys ?? []),
    ];
    if (new Set(bookletFieldKeys).size !== bookletFieldKeys.length) {
      errors.push('Um campo de livreto não pode pertencer a mais de uma camada de preço.');
    }
  }
  if (profile === 'per_square_meter') {
    if (normalized.minWidthCm === undefined || normalized.maxWidthCm === undefined
        || normalized.minHeightCm === undefined || normalized.maxHeightCm === undefined) {
      errors.push('Informe os limites mínimo e máximo de largura e altura do equipamento.');
    }
    if (normalized.minimumBillableAreaCm2 === undefined) errors.push('Informe a área mínima faturável em cm².');
    if (normalized.wasteMarginBps === undefined) errors.push('Informe a margem de perda em pontos-base.');
    if (normalized.validateUploadedPdfDimensions === undefined) {
      errors.push('Defina se as dimensões do PDF enviado devem ser conferidas.');
    }
    if (normalized.validateUploadedPdfDimensions && normalized.pdfDimensionToleranceBps === undefined) {
      errors.push('Informe a tolerância de dimensão do PDF em pontos-base.');
    }
    if (normalized.validateUploadedPdfDimensions && normalized.pdfDimensionPolicy === undefined) {
      errors.push('Defina a política de dimensão do PDF para cotação automática.');
    }
  }
  if (profile === 'per_print_run') {
    if (!normalized.runFieldKey) errors.push('Informe a chave do campo que representa a tiragem.');
    if (normalized.productionLeadTimeBusinessDays === undefined) {
      errors.push('Informe o prazo de produção em dias úteis.');
    }
    if (normalized.requiresArtworkFile === undefined) {
      errors.push('Defina se a tiragem exige arquivo de arte antes da cotação automática.');
    }
    if (normalized.requiresArtworkBleedAcknowledgement === undefined) {
      errors.push('Defina se a tiragem exige ciência de sangria e margem segura.');
    }
  }
  if (normalized.minPages !== undefined && normalized.maxPages !== undefined && normalized.maxPages < normalized.minPages) {
    errors.push('O máximo de páginas não pode ser menor que o mínimo.');
  }
  return errors;
}

export function pricingUnitLabel(profile: PricingProfile): string {
  const labels: Record<PricingProfile, string> = {
    per_page: 'página',
    per_item: 'unidade',
    per_print_run: 'tiragem',
    per_sheet: 'folha física',
    per_square_meter: 'metro quadrado',
    per_linear_meter: 'metro linear',
    binding_by_file_pages: 'arquivo encadernado',
    booklet_imposition: 'livreto finalizado',
    manual_quote: 'orçamento técnico',
  };
  return labels[profile];
}

export const pricingProfileTemplates: Record<PricingProfile, Record<string, Json>> = {
  per_page: {},
  per_item: {},
  per_print_run: {},
  per_sheet: { pages_per_sheet: 1 },
  per_square_meter: {
    pdf_dimension_policy: 'media_box_single_page',
    validate_uploaded_pdf_dimensions: true,
    pdf_dimension_tolerance_bps: 100,
  },
  per_linear_meter: {},
  binding_by_file_pages: {},
  booklet_imposition: {
    page_multiple: 4,
    min_pages: 8,
    allow_blank_page_padding: false,
    requires_customer_approval_for_padding: false,
    booklet_core_field_keys: [],
    booklet_cover_field_keys: [],
    booklet_finishing_field_keys: [],
    booklet_cover_pages: 4,
  },
  manual_quote: {},
};
