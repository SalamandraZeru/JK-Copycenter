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
import type { PdfDimensionReview, PricingDimensions } from '@/types/pricing';

interface ServiceConfiguratorProps {
  service: ServiceWithFields;
}

function formatDimensions(dimensions: PricingDimensions | null | undefined): string | null {
  if (!dimensions?.widthCm || !dimensions.heightCm) return null;
  const format = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return `${format(dimensions.widthCm)} × ${format(dimensions.heightCm)} cm`;
}

function formatCents(value: number): string {
  return (value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function technicalReviewHref(review: PdfDimensionReview): string {
  const entered = formatDimensions(review.enteredDimensions) ?? 'não informada';
  const measured = formatDimensions(review.measuredDimensions) ?? 'não disponível';
  const message = [
    'Olá! Preciso de análise técnica de uma plotagem.',
    `Dimensão informada: ${entered}.`,
    `Dimensão apurada no PDF: ${measured}.`,
    `Motivo da revisão: ${review.status}.`,
  ].join('\n');
  return `https://wa.me/5535991066260?text=${encodeURIComponent(message)}`;
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
    dimensionReview,
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
            ...(pricingResult.bookletImposition
              ? [`Livreto: ${pricingResult.bookletImposition.originalPageCount} páginas originais → ${pricingResult.bookletImposition.imposedPageCount} páginas de produção${pricingResult.bookletImposition.blankPagesAdded > 0 ? ` (+${pricingResult.bookletImposition.blankPagesAdded} em branco)` : ''}`]
              : []),
            ...(pricingResult.bookletPricing
              ? [`Composição: miolo ${formatCents(pricingResult.bookletPricing.coreSubtotalCents)}, capa ${formatCents(pricingResult.bookletPricing.coverSubtotalCents)}, acabamento ${formatCents(pricingResult.bookletPricing.finishingSubtotalCents)} por livreto`]
              : []),
          ],
          fileNames: uploadedFiles.map((file) => file.originalName),
          estimatedTotalCents: pricingResult.totalCents,
          estimatedUnitCents: pricingResult.unitPriceCents,
          calculatedAt: new Date().toISOString(),
          pricingVersion: pricingResult.serviceSnapshot.pricingVersion,
          catalogVersion: pricingResult.serviceSnapshot.catalogVersion,
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
            {...(service.pricingProfile === 'booklet_imposition' ? {
              acceptedExtensions: ['.pdf'],
              maxFiles: 1,
              requirementsText: 'Cotação automática: envie um único PDF completo, já com miolo e capa na ordem final. Capa em arquivo separado ou qualquer outro formato exige análise técnica.',
            } : {})}
          />
          {service.pricingProfile === 'booklet_imposition' && (
            <p className="mt-3 text-xs font-medium text-slate-600">A quantidade de páginas e o tipo do arquivo são conferidos no servidor antes de liberar a cotação.</p>
          )}
          {service.pricingProfile === 'per_square_meter' && profileConfig.validateUploadedPdfDimensions && (
            <p className="mt-3 text-xs font-medium text-slate-600">A cotação automática usa exclusivamente a MediaBox de um único PDF com uma página. Arquivos múltiplos, PDFs com várias páginas ou metadados ambíguos seguem para análise técnica.</p>
          )}
        </div>

        {/* Quantity & Pages */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <h2 className="text-xl font-bold text-slate-900 mb-5">{service.pricingProfile === 'per_print_run' ? 'Tiragem e lotes' : 'Quantidade e Cópias'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {service.pricingProfile !== 'per_print_run' && <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-800">Páginas por Cópia *</label>
              <input
                type="number"
                min="1"
                value={config.pageCount}
                onChange={(e) => updatePageCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="px-3.5 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm font-medium text-slate-900 bg-white"
              />
              <span className="text-xs text-slate-500">Atualizado automaticamente ao anexar arquivos.</span>
            </div>}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-800">{service.pricingProfile === 'per_print_run' ? 'Quantidade de lotes *' : 'Quantidade de Cópias *'}</label>
              <input
                type="number"
                min="1"
                value={config.quantity}
                onChange={(e) => updateQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="px-3.5 py-2.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-sm font-medium text-slate-900 bg-white"
              />
              <span className="text-xs text-slate-500">{service.pricingProfile === 'per_print_run' ? 'A tiragem é escolhida nos campos do serviço; informe quantos lotes iguais deseja.' : 'Mínimo de 1 cópia.'}</span>
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
                  <span>Seu arquivo tem {config.pageCount} páginas e será produzido com {Math.ceil(config.pageCount / pageMultiple) * pageMultiple} páginas ({Math.ceil(config.pageCount / pageMultiple) * pageMultiple - config.pageCount} técnica(s) em branco). A cotação exibida será recalculada sobre a quantidade de produção.</span>
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
          <>
            <PriceDisplay
              estimatedPrice={config.estimatedPrice}
              isLoading={config.isLoadingPrice}
              hasEstimate={pricingResult?.isEstimate ?? false}
              error={hasRequiredSelections ? apiError : null}
            />
            {pricingResult?.bookletImposition && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
                <p className="font-bold">Imposição confirmada</p>
                <p className="mt-1">{pricingResult.bookletImposition.originalPageCount} páginas no arquivo → {pricingResult.bookletImposition.imposedPageCount} páginas para produção{pricingResult.bookletImposition.blankPagesAdded > 0 ? `, com ${pricingResult.bookletImposition.blankPagesAdded} página(s) técnica(s) em branco` : ''}. O preço exibido já considera esta imposição.</p>
                {pricingResult.bookletPricing && (
                  <div className="mt-3 space-y-1 border-t border-blue-200 pt-3 text-xs">
                    <p><strong>Miolo:</strong> {formatCents(pricingResult.bookletPricing.coreSubtotalCents)} por livreto ({pricingResult.bookletPricing.productionPageCount} páginas de produção).</p>
                    <p><strong>Capa:</strong> {formatCents(pricingResult.bookletPricing.coverSubtotalCents)} por livreto ({pricingResult.bookletPricing.coverPages} páginas consideradas).</p>
                    <p><strong>Acabamento:</strong> {formatCents(pricingResult.bookletPricing.finishingSubtotalCents)} por livreto.</p>
                    {pricingResult.bookletPricing.minimumAdjustmentCents > 0 && <p><strong>Mínimo do lote:</strong> {formatCents(pricingResult.bookletPricing.minimumRunCents)}; acréscimo aplicado: {formatCents(pricingResult.bookletPricing.minimumAdjustmentCents)}.</p>}
                  </div>
                )}
              </div>
            )}
            {pricingResult?.squareMeterPricing && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
                <p className="font-bold">Cálculo por área</p>
                <p className="mt-1">Valor por m²: {(pricingResult.squareMeterPricing.rateCentsPerSquareMeter / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Área informada: {(pricingResult.squareMeterPricing.submittedAreaCm2 / 10_000).toLocaleString('pt-BR', { maximumFractionDigits: 4 })} m². Área faturável: {(pricingResult.squareMeterPricing.billableAreaCm2 / 10_000).toLocaleString('pt-BR', { maximumFractionDigits: 4 })} m²{pricingResult.squareMeterPricing.minimumBillableAreaCm2 > pricingResult.squareMeterPricing.submittedAreaCm2 ? ` (mínimo: ${(pricingResult.squareMeterPricing.minimumBillableAreaCm2 / 10_000).toLocaleString('pt-BR', { maximumFractionDigits: 4 })} m²)` : ''}{pricingResult.squareMeterPricing.wasteMarginBps > 0 ? `, incluindo ${pricingResult.squareMeterPricing.wasteMarginBps / 100}% de margem de perda` : ''}.</p>
                {pricingResult.squareMeterPricing.additionsCentsPerUnit > 0 && <p className="mt-1">Adicionais da configuração: {(pricingResult.squareMeterPricing.additionsCentsPerUnit / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por unidade.</p>}
                {pricingResult.squareMeterPricing.dimensionReview.status === 'verified' && <p className="mt-1 text-xs font-medium">Dimensões conferidas na MediaBox do PDF enviado: {formatDimensions(pricingResult.squareMeterPricing.dimensionReview.measuredDimensions)}.</p>}
              </div>
            )}
            {dimensionReview && dimensionReview.status !== 'not_required' && dimensionReview.status !== 'verified' && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-bold">Revisão de dimensão necessária</p>
                {dimensionReview.status === 'declared_mismatch' && (
                  <p className="mt-1">Informado: {formatDimensions(dimensionReview.enteredDimensions)}. MediaBox do PDF: {formatDimensions(dimensionReview.measuredDimensions)}. A cotação é liberada somente após usar a dimensão do arquivo ou após análise técnica.</p>
                )}
                {dimensionReview.status !== 'declared_mismatch' && <p className="mt-1">A dimensão não pode ser confirmada automaticamente para este arquivo. Envie um único PDF de uma página ou solicite análise técnica.</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {dimensionReview.status === 'declared_mismatch' && dimensionReview.measuredDimensions && (
                    <button
                      type="button"
                      onClick={() => {
                        const measuredDimensions = dimensionReview.measuredDimensions;
                        if (measuredDimensions) updateDimensions(measuredDimensions);
                      }}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                    >
                      Usar dimensão da MediaBox
                    </button>
                  )}
                  <a
                    href={technicalReviewHref(dimensionReview)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-amber-700 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100"
                  >
                    Solicitar análise técnica
                  </a>
                </div>
              </div>
            )}
          </>
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
