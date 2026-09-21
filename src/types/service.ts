import type { FieldType } from './index';
import type { PricingDimensions, PricingProfile, PricingProfileConfig } from './pricing';

export interface ServiceFieldOption {
  value: string;
  label: string;
}

export interface ServiceField {
  id: string;
  serviceId: string;
  key: string;
  label: string;
  fieldType: FieldType;
  options: ServiceFieldOption[];
  isRequired: boolean;
  sortOrder: number;
}

export interface ServiceFieldOptionDependency {
  sourceFieldId: string;
  sourceOptionValue: string;
  sourceConditions?: ServiceFieldOptionCondition[];
  targetFieldId: string;
  targetOptionValue: string;
}

export interface ServiceFieldOptionCondition {
  fieldId: string;
  optionValue: string;
}

export interface ServiceWithFields {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  pricingProfile: PricingProfile;
  pricingProfileConfig: PricingProfileConfig;
  bindingAvailable: boolean;
  fields: ServiceField[];
  fieldOptionDependencies: ServiceFieldOptionDependency[];
}

export type GraphicQuoteTechnicalKind =
  | 'standard'
  | 'booklet'
  | 'square_meter'
  | 'linear_meter'
  | 'print_run';

/**
 * Public, non-commercial production constraints used by the manual quote UI.
 * Prices, margins and billable minimums must never be added to this contract.
 */
export interface GraphicQuoteTechnicalRequirements {
  kind: GraphicQuoteTechnicalKind;
  requireCompleteCompatibility: boolean;
  minPages?: number;
  maxPages?: number;
  pageMultiple?: number;
  allowBlankPagePadding?: boolean;
  requiresCustomerApprovalForPadding?: boolean;
  minWidthCm?: number;
  maxWidthCm?: number;
  minHeightCm?: number;
  maxHeightCm?: number;
  validateUploadedPdfDimensions?: boolean;
  requiresArtworkBleedAcknowledgement?: boolean;
}

/** Dedicated public contract for graphic requests. It intentionally has no price fields. */
export interface GraphicQuoteService {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  commercialMode: 'manual_quote';
  bindingAvailable: boolean;
  technicalRequirements: GraphicQuoteTechnicalRequirements;
  fields: ServiceField[];
  fieldOptionDependencies: ServiceFieldOptionDependency[];
}

export interface FieldValue {
  fieldKey: string;
  value: string | number | boolean;
  label: string;
  selectedOption?: ServiceFieldOption;
}

export interface ServiceConfiguration {
  serviceId: string;
  attributeIds: string[];
  fieldValues: FieldValue[];
  pageCount: number;
  isFrontAndBack: boolean;
  quantity: number;
  fileIds: string[];
  bindingFileIds: string[];
  dimensions: PricingDimensions;
  bookletPaddingApproved: boolean;
  artworkBleedAcknowledged: boolean;
  estimatedPrice: number | null;
  isLoadingPrice: boolean;
}
