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
import { useCartStore } from '@/lib/cart/store';
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
    replaceFiles,
    validate,
    isValid,
    validationErrors,
    error: apiError
  } = useServiceConfigurator(service);

  const hasRequiredSelections = service.fields
    .filter((field) => field.isRequired)
    .every((field) => config.fieldValues.some((value) => (
      value.fieldKey === field.key && value.value !== '' && value.value !== false
    )));

  const handleAddToCart = () => {
    if (validate()) {
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
      });
    }
  };

  const renderField = (field: ServiceField) => {
    const error = validationErrors[field.key];
    const props = {
      field,
      value: config.fieldValues.find(fv => fv.fieldKey === field.key),
      onChange: (val: FieldValue) => updateFieldValue(field.key, val),
      ...(error ? { error } : {}),
    };

    switch (field.fieldType) {
      case 'select': return <SelectField key={field.key} {...props} />;
      case 'radio': return <RadioField key={field.key} {...props} />;
      case 'number': return <NumberField key={field.key} {...props} />;
      case 'text': return <TextField key={field.key} {...props} />;
      case 'textarea': return <TextareaField key={field.key} {...props} />;
      case 'checkbox': return <CheckboxField key={field.key} {...props} />;
      default: return null;
    }
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
        </div>
      </div>

      {/* Right Col - Summary */}
      <div className="flex flex-col gap-6">
        <PriceDisplay 
          estimatedPrice={config.estimatedPrice} 
          isLoading={config.isLoadingPrice} 
          hasEstimate={false} 
          error={hasRequiredSelections ? apiError : null}
        />
        
        <button
          onClick={handleAddToCart}
          disabled={!isValid || config.isLoadingPrice}
          className="w-full bg-blue-600 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2"
        >
          <ShoppingCart className="w-5 h-5" />
          {config.isLoadingPrice ? 'Calculando Preço...' : 'Adicionar ao Carrinho'}
        </button>
      </div>
    </div>
  );
}
