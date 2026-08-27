import type { Json } from '@/types/supabase';
import type { PricingProfile, PricingProfileConfig } from '@/types/pricing';

const profiles: PricingProfile[] = [
  'per_page',
  'per_item',
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

  const normalized: PricingProfileConfig = {};
  if (pagesPerSheet !== undefined) normalized.pagesPerSheet = pagesPerSheet;
  if (minPages !== undefined) normalized.minPages = minPages;
  if (maxPages !== undefined && (minPages === undefined || maxPages >= minPages)) normalized.maxPages = maxPages;
  if (pageMultiple !== undefined) normalized.pageMultiple = pageMultiple;
  if (allowBlankPagePadding !== undefined) normalized.allowBlankPagePadding = allowBlankPagePadding;
  if (requiresCustomerApprovalForPadding !== undefined) normalized.requiresCustomerApprovalForPadding = requiresCustomerApprovalForPadding;
  if (requireCompleteCompatibility !== undefined) normalized.requireCompleteCompatibility = requireCompleteCompatibility;
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
  per_sheet: { pages_per_sheet: 1 },
  per_square_meter: {},
  per_linear_meter: {},
  binding_by_file_pages: {},
  booklet_imposition: {
    page_multiple: 4,
    min_pages: 8,
    allow_blank_page_padding: false,
    requires_customer_approval_for_padding: false,
  },
  manual_quote: {},
};
