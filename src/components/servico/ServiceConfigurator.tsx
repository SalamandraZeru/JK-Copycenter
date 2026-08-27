'use client';

import React, { useState } from 'react';
import type { ServiceWithFields, ServiceField, FieldValue } from '@/types/service';
import { useServiceConfigurator } from '@/hooks/useServiceConfigurator';
import { PriceDisplay } from './PriceDisplay';
import { SelectField } from './fields/SelectField';
import { RadioField } from './fields/RadioField';
import { NumberField } from './fields/NumberField';
import { TextField } from './fields/TextField';
import { TextareaField } from './fields/TextareaField';
import { CheckboxField } from './fields/CheckboxField';
import { FileUploadDropzone, type UploadedFileItem } from './FileUploadDropzone';
import { createCartDisplaySnapshot, useCartStore } from '@/lib/cart/store';
import { ShoppingCart } from 'lucide-react';

interface ServiceConfiguratorProps {
  service: ServiceWithFields;
}

export function ServiceConfigurator({ service }: ServiceConfiguratorProps) {
  const addItem = useCartStore(state => state.addItem);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);

  const {
    config,
    updateFieldValue,
    updatePageCount,
    updateQuantity,
    updateDimensions,
    setBookletPaddingApproved,
    replaceFiles,
    setBindingFileIds,
    validate,
    isValid,
    validationErrors,
    fieldOptionAvailability,
    error: apiError,
    pricingResult,
  } = useServiceConfigurator(service);

  const profileConfig = service.pricingProfileConfig;
  const isManualQuote = service.pricingProfile === 'manual_quote';
  const pageMultiple = profileConfig.pageMultiple ?? 4;
  const bookletNeedsPadding = service.pricingProfile === 'booklet_imposition'
    && config.pageCount % pageMultiple !== 0;

  const hasRequiredSelections = service.fields
    .filter((field) => field.isRequired)
    .every((field) => config.fieldValues.some((value) => (
      value.fieldKey === field.key && value.value !== '' && value.value !== false
    )));

  const handleAddToCart = () => {
    if (validate() && pricingResult) {
      addItem({
        serviceId: service.id,
        type: 'service',
        name: service.name,
        imageUrl: service.imageUrl,
        basePrice: service.basePrice,
        estimatedTotal: config.estimatedPrice || service.basePrice,
        attributeIds: [],
        fieldValues: config.fieldValues,
        pageCount: config.pageCount,
        isFrontAndBack: false,
        quantity: config.quantity,
        fileIds: uploadedFiles.map(f => f.fileId),
        bindingFileIds: config.bindingFileIds,
        dimensions: config.dimensions,
        bookletPaddingApproved: config.bookletPaddingApproved,
        displaySnapshot: createCartDisplaySnapshot({
          serviceId: service.id,
          attributeIds: [],
          fieldValues: config.fieldValues,
          pageCount: config.pageCount,
          isFrontAndBack: false,
          quantity: config.quantity,
          bindingFileIds: config.bindingFileIds,
          dimensions: config.dimensions,
          bookletPaddingApproved: config.bookletPaddingApproved,
          name: pricingResult.serviceSnapshot.name,
          imageUrl: service.imageUrl,
          estimatedTotal: pricingResult.totalCents / 100,
        }, {
          title: pricingResult.serviceSnapshot.name,
          imageUrl: service.imageUrl,
          summary: [
            ...pricingResult.fieldsSnapshot.map((field) => `${field.fieldLabel}: ${field.valueLabel}`),
            ...(pricingResult.bindingSelections.length > 0
              ? [`Encadernação: ${pricingResult.bindingSelections.length} arquivo(s) selecionado(s)`]
              : []),
            ...(pricingResult.bookletPaddedPages
              ? [`Livreto: ${pricingResult.bookletPaddedPages} páginas após complementação técnica`]
              : []),
          ],
          fileNames: uploadedFiles.map((file) => file.originalName),
          estimatedTotalCents: pricingResult.totalCents,
          estimatedUnitCents: pricingResult.unitPriceCents,
          calculatedAt: new Date().toISOString(),
          pricingVersion: pricingResult.serviceSnapshot.pricingVersion,
          isEstimate: pricingResult.isEstimate,
        }),
      });
    }
  };

  const renderField = (field: ServiceField) => {
    const error = validationErrors[field.key];
    const availability = fieldOptionAvailability.get(field.id);
    const checkboxUnavailable = field.fieldType === 'checkbox'
      && availability?.isRestricted
      && !availability.allowedOptionValues.has('true');
    if (checkboxUnavailable) {
      return (
        <div key={field.key} className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
          <span className="font-semibold">{field.label}:</span> indisponível para a configuração selecionada.
        </div>
      );
    }
    const resolvedField = availability?.isRestricted
      ? {
        ...field,
        options: field.options.filter((option) => availability.allowedOptionValues.has(option.value)),
      }
      : field;
    const props = {
      field: resolvedField,
      value: config.fieldValues.find(fv => fv.fieldKey === field.key),
      onChange: (val: FieldValue) => updateFieldValue(field.key, val),
      ...(error ? { error } : {}),
    };

    let content: React.ReactNode = null;
    switch (field.fieldType) {
      case 'select': content = <SelectField {...props} />; break;
      case 'radio': content = <RadioField {...props} />; break;
      case 'number': content = <NumberField {...props} />; break;
      case 'text': content = <TextField {...props} />; break;
      case 'textarea': content = <TextareaField {...props} />; break;
      case 'checkbox': content = <CheckboxField {...props} />; break;
      default: return null;
    }

    return (
      <div key={field.key} className="contents">
        {content}
        {availability?.isRestricted && (
          <p className="-mt-4 text-xs font-medium text-slate-500">
            Opções disponíveis conforme as escolhas anteriores.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Col - Options & Upload */}
      <div className="lg:col-span-2 flex flex-col gap-8">
        {/* Dynamic Fields */}
        {service.fields.length > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-xl font-bold text-slate-900 mb-5">Configuração do Serviço</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {service.fields.map(renderField)}
            </div>
          </div>
        )}

        {/* File Upload Dropzone */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <FileUploadDropzone
            files={uploadedFiles}
            onFilesChange={(files) => {
              setUploadedFiles(files);
              replaceFiles(files.map((file) => file.fileId));
            }}
            onPageCountUpdate={updatePageCount}
            bindingAvailable={service.bindingAvailable}
            bindingFileIds={config.bindingFileIds}
            onBindingFileIdsChange={setBindingFileIds}
          />
        </div>

        {/* Quantity & Pages */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <h2 className="text-xl font-bold text-slate-900 mb-5">Quantidade e Cópias</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-800">Páginas por Cópia *</label>
              <input
                type="number"
                min="1"
                value={config.pageCount}
                onChange={(e) => updatePageCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="px-3.5 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm font-medium text-slate-900 bg-white"
              />
              <span className="text-xs text-slate-500">Atualizado automaticamente ao anexar arquivos.</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-800">Quantidade de Cópias *</label>
              <input
                type="number"
                min="1"
                value={config.quantity}
                onChange={(e) => updateQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="px-3.5 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm font-medium text-slate-900 bg-white"
              />
              <span className="text-xs text-slate-500">Mínimo de 1 cópia.</span>
            </div>
          </div>
          {service.pricingProfile === 'per_square_meter' && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-800">Largura (cm) *</label>
                <input type="number" min="0.01" step="0.01" value={config.dimensions.widthCm ?? ''}
                  onChange={(event) => updateDimensions({ ...config.dimensions, widthCm: Number(event.target.value) || undefined })}
                  className="px-3.5 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-medium text-slate-900" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-800">Altura (cm) *</label>
                <input type="number" min="0.01" step="0.01" value={config.dimensions.heightCm ?? ''}
                  onChange={(event) => updateDimensions({ ...config.dimensions, heightCm: Number(event.target.value) || undefined })}
                  className="px-3.5 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-medium text-slate-900" />
              </div>
            </div>
          )}
          {service.pricingProfile === 'per_linear_meter' && (
            <div className="mt-6 max-w-md flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-800">Comprimento (cm) *</label>
              <input type="number" min="0.01" step="0.01" value={config.dimensions.lengthCm ?? ''}
                onChange={(event) => updateDimensions({ ...config.dimensions, lengthCm: Number(event.target.value) || undefined })}
                className="px-3.5 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm font-medium text-slate-900" />
            </div>
          )}
          {service.pricingProfile === 'booklet_imposition' && bookletNeedsPadding && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              {profileConfig.allowBlankPagePadding ? (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={config.bookletPaddingApproved}
                    onChange={(event) => setBookletPaddingApproved(event.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span>Seu livreto será ajustado para {Math.ceil(config.pageCount / pageMultiple) * pageMultiple} páginas, com páginas técnicas em branco quando necessário.</span>
                </label>
              ) : (
                <span>Este livreto deve ter um total de páginas múltiplo de {pageMultiple}.</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Col - Summary */}
      <div className="flex flex-col gap-6">
        {isManualQuote ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
            <h2 className="font-bold text-base">Orçamento técnico</h2>
            <p className="mt-2">Este serviço é analisado pela equipe antes da confirmação. Envie seus arquivos e detalhes para receber a cotação.</p>
          </div>
        ) : (
          <PriceDisplay
            estimatedPrice={config.estimatedPrice}
            isLoading={config.isLoadingPrice}
            hasEstimate={pricingResult?.isEstimate ?? false}
            error={hasRequiredSelections ? apiError : null}
          />
        )}
        
        <button
          onClick={handleAddToCart}
          disabled={isManualQuote || !isValid || config.isLoadingPrice || !pricingResult}
          className="w-full bg-blue-600 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2"
        >
          <ShoppingCart className="w-5 h-5" />
          {isManualQuote
            ? 'Orçamento sob consulta'
            : config.isLoadingPrice
            ? 'Calculando Preço...'
            : !pricingResult
              ? 'Aguardando cotação'
              : 'Adicionar ao Carrinho'}
        </button>
      </div>
    </div>
  );
}
