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
  estimatedPrice: number | null;
  isLoadingPrice: boolean;
}
