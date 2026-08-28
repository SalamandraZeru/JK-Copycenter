import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ServiceWithFields, ServiceConfiguration, FieldValue } from '@/types/service';
import { usePricingPreview } from './usePricingPreview';
import { isFieldOptionSelectionAllowed, resolveFieldOptionAvailability } from '@/lib/services/field-option-dependencies';
import type { PricingDimensions } from '@/types/pricing';

function selectedValuesByFieldId(service: ServiceWithFields, values: FieldValue[]) {
  const fieldsByKey = new Map(service.fields.map((field) => [field.key, field]));
  const selected = new Map<string, string | number | boolean>();
  for (const value of values) {
    const field = fieldsByKey.get(value.fieldKey);
    if (field) selected.set(field.id, value.value);
  }
  return selected;
}

function normalizeDependentFieldValues(service: ServiceWithFields, values: FieldValue[]): FieldValue[] {
  let normalized = values;
  for (let attempt = 0; attempt < service.fields.length; attempt += 1) {
    const selected = selectedValuesByFieldId(service, normalized);
    const next = normalized.filter((value) => {
      const field = service.fields.find((candidate) => candidate.key === value.fieldKey);
      return !field || isFieldOptionSelectionAllowed(
        service.fieldOptionDependencies,
        selected,
        field.id,
        value.value,
        { requireCompletePathMatch: service.pricingProfileConfig.requireCompleteCompatibility === true },
      );
    });
    if (next.length === normalized.length) return normalized;
    normalized = next;
  }
  return normalized;
}

export function useServiceConfigurator(service: ServiceWithFields) {
  const [config, setConfig] = useState<ServiceConfiguration>({
    serviceId: service.id,
    attributeIds: [],
    fieldValues: [],
    pageCount: 1,
    isFrontAndBack: false,
    quantity: 1,
    fileIds: [],
    bindingFileIds: [],
    dimensions: {},
    bookletPaddingApproved: false,
    estimatedPrice: service.basePrice,
    isLoadingPrice: false,
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { fetchPreview, result, isLoading, error, dimensionReview } = usePricingPreview();

  const fieldOptionAvailability = useMemo(() => {
    const selected = selectedValuesByFieldId(service, config.fieldValues);
    return new Map(service.fields.map((field) => [
      field.id,
      resolveFieldOptionAvailability(service.fieldOptionDependencies, selected, field.id, {
        requireCompletePathMatch: service.pricingProfileConfig.requireCompleteCompatibility === true,
      }),
    ]));
  }, [config.fieldValues, service]);

  const isConfigurationComplete = useMemo(() => {
    if (config.quantity < 1 || config.pageCount < 1) return false;
    if (service.pricingProfile === 'manual_quote') return false;
    if (service.pricingProfile === 'per_square_meter'
        && (!(config.dimensions.widthCm && config.dimensions.widthCm > 0)
          || !(config.dimensions.heightCm && config.dimensions.heightCm > 0))) return false;
    if (service.pricingProfile === 'per_linear_meter'
        && (!(config.dimensions.lengthCm && config.dimensions.lengthCm > 0))) return false;
    if (service.pricingProfile === 'booklet_imposition') {
      if (config.fileIds.length === 0) return false;
      const profileConfig = service.pricingProfileConfig;
      const pageMultiple = profileConfig.pageMultiple ?? 4;
      const mustPad = config.pageCount % pageMultiple !== 0;
      if (mustPad && !profileConfig.allowBlankPagePadding) return false;
      if (mustPad && profileConfig.requiresCustomerApprovalForPadding && !config.bookletPaddingApproved) return false;
    }
    return service.fields
      .filter((field) => field.isRequired)
      .every((field) => {
        const availability = fieldOptionAvailability.get(field.id);
        if (field.fieldType === 'checkbox' && availability?.isRestricted
            && !availability.allowedOptionValues.has('true')) {
          return true;
        }
        const value = config.fieldValues.find((fieldValue) => fieldValue.fieldKey === field.key);
        return Boolean(value && value.value !== '' && value.value !== false);
      });
  }, [
    config.bookletPaddingApproved,
    config.dimensions.heightCm,
    config.dimensions.lengthCm,
    config.dimensions.widthCm,
    config.fieldValues,
    config.fileIds.length,
    config.pageCount,
    config.quantity,
    fieldOptionAvailability,
    service.fields,
    service.pricingProfile,
    service.pricingProfileConfig,
  ]);

  useEffect(() => {
    if (!isConfigurationComplete) return;
    const timer = setTimeout(() => {
      fetchPreview({
        serviceId: config.serviceId,
        attributeIds: config.attributeIds,
        fieldValues: config.fieldValues.map((field) => ({
          fieldKey: field.fieldKey,
          value: field.value,
        })),
        fileIds: config.fileIds,
        bindingFileIds: config.bindingFileIds,
        pageCount: config.pageCount,
        isFrontAndBack: config.isFrontAndBack,
        quantity: config.quantity,
        dimensions: config.dimensions,
        bookletPaddingApproved: config.bookletPaddingApproved,
      }).catch(console.error);
    }, 500);

    return () => clearTimeout(timer);
  }, [
    config.serviceId,
    config.attributeIds,
    config.fieldValues,
    config.pageCount,
    config.fileIds,
    config.bindingFileIds,
    config.isFrontAndBack,
    config.quantity,
    config.dimensions,
    config.bookletPaddingApproved,
    fetchPreview,
    isConfigurationComplete,
  ]);

  useEffect(() => {
    setConfig(prev => ({
      ...prev,
      estimatedPrice: result ? result.totalCents / 100 : prev.estimatedPrice,
      isLoadingPrice: isLoading
    }));
  }, [result, isLoading]);

  const updateAttribute = useCallback((attributeId: string, groupId: string) => {
    setConfig(prev => {
      // In a real scenario, you'd replace the attribute for the specific groupId.
      // Since groupId is not directly tracked in config, we simply add/remove for now.
      const newAttr = prev.attributeIds.includes(attributeId)
        ? prev.attributeIds.filter(id => id !== attributeId)
        : [...prev.attributeIds, attributeId];
      return { ...prev, attributeIds: newAttr };
    });
  }, []);

  const updateFieldValue = useCallback((fieldKey: string, value: FieldValue) => {
    setConfig(prev => {
      const existing = prev.fieldValues.filter(fv => fv.fieldKey !== fieldKey);
      return {
        ...prev,
        fieldValues: normalizeDependentFieldValues(service, [...existing, value])
      };
    });
    
    setValidationErrors(prev => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }, [service]);

  const updatePageCount = useCallback((count: number) => {
    setConfig(prev => ({ ...prev, pageCount: count }));
  }, []);

  const updateQuantity = useCallback((qty: number) => {
    setConfig(prev => ({ ...prev, quantity: qty }));
  }, []);

  const updateDimensions = useCallback((dimensions: PricingDimensions) => {
    setConfig(prev => ({ ...prev, dimensions }));
  }, []);

  const setBookletPaddingApproved = useCallback((bookletPaddingApproved: boolean) => {
    setConfig(prev => ({ ...prev, bookletPaddingApproved }));
  }, []);

  const addFile = useCallback((fileId: string) => {
    setConfig(prev => ({ ...prev, fileIds: [...prev.fileIds, fileId] }));
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setConfig(prev => ({ ...prev, fileIds: prev.fileIds.filter(id => id !== fileId) }));
  }, []);

  const replaceFiles = useCallback((fileIds: string[]) => {
    setConfig(prev => ({
      ...prev,
      fileIds,
      bindingFileIds: prev.bindingFileIds.filter((fileId) => fileIds.includes(fileId)),
    }));
  }, []);

  const setBindingFileIds = useCallback((bindingFileIds: string[]) => {
    setConfig((prev) => ({
      ...prev,
      bindingFileIds: Array.from(new Set(bindingFileIds)).filter((fileId) => prev.fileIds.includes(fileId)),
    }));
  }, []);

  const validate = useCallback(() => {
    const errors: Record<string, string> = {};
    let valid = true;
    
    service.fields.forEach(field => {
      if (field.isRequired) {
        const availability = fieldOptionAvailability.get(field.id);
        if (field.fieldType === 'checkbox' && availability?.isRestricted
            && !availability.allowedOptionValues.has('true')) {
          return;
        }
        const val = config.fieldValues.find(fv => fv.fieldKey === field.key);
        if (!val || val.value === '' || val.value === false) {
          errors[field.key] = 'Campo obrigatório';
          valid = false;
        }
      }
    });

    if (config.quantity < 1) valid = false;
    if (config.pageCount < 1) valid = false;
    
    setValidationErrors(errors);
    return valid;
  }, [config.fieldValues, config.quantity, config.pageCount, fieldOptionAvailability, service.fields]);

  const isValid = isConfigurationComplete;

  return {
    config,
    updateAttribute,
    updateFieldValue,
    updatePageCount,
    updateQuantity,
    updateDimensions,
    setBookletPaddingApproved,
    addFile,
    removeFile,
    replaceFiles,
    setBindingFileIds,
    validate,
    isValid,
    validationErrors,
    fieldOptionAvailability,
    error,
    dimensionReview,
    pricingResult: result,
  };
}
