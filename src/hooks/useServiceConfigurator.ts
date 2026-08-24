import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ServiceWithFields, ServiceConfiguration, FieldValue } from '@/types/service';
import { usePricingPreview } from './usePricingPreview';

export function useServiceConfigurator(service: ServiceWithFields) {
  const [config, setConfig] = useState<ServiceConfiguration>({
    serviceId: service.id,
    attributeIds: [],
    fieldValues: [],
    pageCount: 1,
    isFrontAndBack: false,
    quantity: 1,
    fileIds: [],
    estimatedPrice: service.basePrice,
    isLoadingPrice: false,
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const { fetchPreview, result, isLoading, error } = usePricingPreview();

  const isConfigurationComplete = useMemo(() => {
    if (config.quantity < 1 || config.pageCount < 1) return false;
    return service.fields
      .filter((field) => field.isRequired)
      .every((field) => {
        const value = config.fieldValues.find((fieldValue) => fieldValue.fieldKey === field.key);
        return Boolean(value && value.value !== '' && value.value !== false);
      });
  }, [config.fieldValues, config.pageCount, config.quantity, service.fields]);

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
        pageCount: config.pageCount,
        isFrontAndBack: config.isFrontAndBack,
        quantity: config.quantity,
      }).catch(console.error);
    }, 500);

    return () => clearTimeout(timer);
  }, [
    config.serviceId,
    config.attributeIds,
    config.fieldValues,
    config.pageCount,
    config.fileIds,
    config.isFrontAndBack,
    config.quantity,
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
        fieldValues: [...existing, value]
      };
    });
    
    setValidationErrors(prev => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }, []);

  const updatePageCount = useCallback((count: number) => {
    setConfig(prev => ({ ...prev, pageCount: count }));
  }, []);

  const updateQuantity = useCallback((qty: number) => {
    setConfig(prev => ({ ...prev, quantity: qty }));
  }, []);

  const addFile = useCallback((fileId: string) => {
    setConfig(prev => ({ ...prev, fileIds: [...prev.fileIds, fileId] }));
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setConfig(prev => ({ ...prev, fileIds: prev.fileIds.filter(id => id !== fileId) }));
  }, []);

  const replaceFiles = useCallback((fileIds: string[]) => {
    setConfig(prev => ({ ...prev, fileIds }));
  }, []);

  const validate = useCallback(() => {
    const errors: Record<string, string> = {};
    let valid = true;
    
    service.fields.forEach(field => {
      if (field.isRequired) {
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
  }, [config.fieldValues, config.quantity, config.pageCount, service.fields]);

  const isValid = isConfigurationComplete;

  return {
    config,
    updateAttribute,
    updateFieldValue,
    updatePageCount,
    updateQuantity,
    addFile,
    removeFile,
    replaceFiles,
    validate,
    isValid,
    validationErrors,
    error
  };
}
