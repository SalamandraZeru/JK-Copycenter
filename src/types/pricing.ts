export type FallbackBehavior = 'use_base' | 'block';
export type PricingRoundingMode = 'half_up' | 'floor' | 'ceil';
export type PricingProfile =
  | 'per_page'
  | 'per_item'
  | 'per_sheet'
  | 'per_square_meter'
  | 'per_linear_meter'
  | 'binding_by_file_pages'
  | 'booklet_imposition'
  | 'manual_quote';

export interface PricingProfileConfig {
  pagesPerSheet?: number;
  minPages?: number;
  maxPages?: number;
  pageMultiple?: number;
  allowBlankPagePadding?: boolean;
  requiresCustomerApprovalForPadding?: boolean;
  /** Uses configured option paths as an allow-list once their antecedents are selected. */
  requireCompleteCompatibility?: boolean;
}

export interface PricingDimensions {
  widthCm?: number | undefined;
  heightCm?: number | undefined;
  lengthCm?: number | undefined;
}

export interface PricingRuleAttribute {
  attributeId: string | null;
  groupId: string;
}

export interface PricingRuleFieldCondition {
  fieldId: string;
  expectedValue: string | number | boolean | null;
}

export interface PricingRule {
  id: string;
  serviceId: string;
  name: string;
  pricePerPageCents: number;
  version: number;
  isActive: boolean;
  attributes: PricingRuleAttribute[];
  fieldConditions: PricingRuleFieldCondition[];
}

export interface PricingDiscount {
  id: string;
  minQuantity: number;
  maxQuantity: number | null;
  discountBps: number;
}

export interface BindingPriceTier {
  id: string;
  serviceId: string;
  minPages: number;
  maxPages: number | null;
  priceCents: number;
  isActive: boolean;
}

export interface FieldOptionDependency {
  sourceFieldId: string;
  sourceOptionValue: string;
  sourceConditions?: FieldOptionCondition[];
  targetFieldId: string;
  targetOptionValue: string;
}

export interface FieldOptionCondition {
  fieldId: string;
  optionValue: string;
}

export interface BindingFileSelection {
  fileId: string;
  pageCount: number;
}

export interface BindingSelectionSnapshot {
  fileId: string;
  pageCount: number;
  tierId: string;
  priceCents: number;
}

export type ServerFieldPriceEffect =
  | { type: 'none' }
  | { type: 'fixed' | 'per_page'; valueCents: number }
  | { type: 'multiply'; multiplierBps: number };

export interface ServerPricingOption {
  value: string;
  label: string;
  isActive: boolean;
  priceEffect: ServerFieldPriceEffect;
}

export interface ServerPricingField {
  id: string;
  key: string;
  label: string;
  fieldType: 'select' | 'radio' | 'number' | 'text' | 'textarea' | 'checkbox';
  isRequired: boolean;
  isActive: boolean;
  options: ServerPricingOption[];
}

export interface PricingAttribute {
  id: string;
  groupId: string;
  isActive: boolean;
}

export interface PricingContext {
  service: {
    id: string;
    name: string;
    description: string | null;
    basePriceCents: number;
    fallbackBehavior: FallbackBehavior;
    pricingVersion: number;
    pricingProfile: PricingProfile;
    pricingProfileConfig: PricingProfileConfig;
  };
  attributes: PricingAttribute[];
  fields: ServerPricingField[];
  rules: PricingRule[];
  discounts: PricingDiscount[];
  bindingTiers: BindingPriceTier[];
  fieldOptionDependencies: FieldOptionDependency[];
  doubleSidedMultiplierBps: number;
  roundingMode: PricingRoundingMode;
}

export interface PricingFieldSelection {
  fieldKey: string;
  value: string | number | boolean;
}

export interface PricingCalculationInput {
  serviceId: string;
  attributeIds: string[];
  fieldValues: PricingFieldSelection[];
  pageCount: number;
  isFrontAndBack: boolean;
  quantity: number;
  fileIds?: string[];
  bindingFileIds?: string[];
  // Esta lista só é preenchida pelo servidor, após conferir a titularidade e
  // os metadados dos arquivos. Nunca é montada diretamente pelo navegador.
  bindingFiles?: BindingFileSelection[];
  dimensions?: PricingDimensions;
  bookletPaddingApproved?: boolean;
}

export interface PricingFieldSnapshot {
  fieldKey: string;
  fieldLabel: string;
  value: string | number | boolean;
  valueLabel: string;
  priceEffect: ServerFieldPriceEffect;
}

export interface PricingCalculationResult {
  serviceSnapshot: {
    id: string;
    name: string;
      description: string | null;
      pricingVersion: number;
      pricingProfile: PricingProfile;
      pricingProfileConfig: PricingProfileConfig;
  };
  ruleId: string | null;
  ruleName: string;
  ruleVersion: number | null;
  pricePerPageCents: number;
  pricingUnit: string;
  dimensions: PricingDimensions | null;
  bookletPaddedPages: number | null;
  unitPriceCents: number;
  subtotalBeforeDiscountCents: number;
  discountBps: number;
  discountCents: number;
  totalCents: number;
  bindingUnitCents: number;
  bindingTotalCents: number;
  bindingSelections: BindingSelectionSnapshot[];
  fieldsSnapshot: PricingFieldSnapshot[];
  attributeIdsSnapshot: string[];
  pageCount: number;
  quantity: number;
  isFrontAndBack: boolean;
  doubleSidedMultiplierBps: number;
  roundingMode: PricingRoundingMode;
  isEstimate: boolean;
  usedFallback: boolean;
}

export type PricingErrorCode = 'QUOTE_UNAVAILABLE' | 'INVALID_INPUT';

export interface PricingError {
  code: PricingErrorCode;
  message: string;
}

export type PricingResult =
  | { success: true; data: PricingCalculationResult }
  | { success: false; error: PricingError };
