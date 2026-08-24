import type { FieldType } from './index';

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

export interface ServiceWithFields {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  fields: ServiceField[];
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
  estimatedPrice: number | null;
  isLoadingPrice: boolean;
}
