import type {
  BookletFileAssessment,
  BookletImpositionSnapshot,
  BookletPricingComponent,
  BookletPricingComponentKind,
  BookletPricingSnapshot,
  BindingSelectionSnapshot,
  PricingCalculationInput,
  PricingContext,
  PricingFieldSnapshot,
  PricingDimensions,
  PrintRunSnapshot,
  PdfDimensionReview,
  PricingProfile,
  PricingResult,
  PricingRoundingMode,
  PricingRule,
  SquareMeterPricingSnapshot,
  ServerFieldPriceEffect,
} from '@/types/pricing';
import { isFieldOptionSelectionAllowed, resolveFieldOptionAvailability } from '@/lib/services/field-option-dependencies';

const BPS_SCALE = 10_000;

function error(
  code: 'QUOTE_UNAVAILABLE' | 'INVALID_INPUT',
  message: string,
  dimensionReview?: PdfDimensionReview,
): PricingResult {
  return { success: false, error: { code, message, ...(dimensionReview ? { dimensionReview } : {}) } };
}

function divideRounded(numerator: number, denominator: number, mode: PricingRoundingMode): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new Error('UNSAFE_MONEY_OPERATION');
  }
  if (mode === 'floor') return Math.floor(numerator / denominator);
  if (mode === 'ceil') return Math.ceil(numerator / denominator);
  return Math.floor((numerator + denominator / 2) / denominator);
}

function applyBps(valueCents: number, multiplierBps: number, mode: PricingRoundingMode): number {
  return divideRounded(valueCents * multiplierBps, BPS_SCALE, mode);
}

function matchesRule(
  rule: PricingRule,
  selectedByGroup: Map<string, string>,
  selectedFieldsById: Map<string, string | number | boolean>
): boolean {
  const legacyMatches = rule.attributes.every((constraint) => {
    const selected = selectedByGroup.get(constraint.groupId);
    if (!selected) return false;
    return constraint.attributeId === null || constraint.attributeId === selected;
  });
  if (!legacyMatches) return false;

  return rule.fieldConditions.every((condition) => {
    if (condition.expectedValue === null) return true;
    return selectedFieldsById.get(condition.fieldId) === condition.expectedValue;
  });
}

function resolveRule(
  context: PricingContext,
  selectedByGroup: Map<string, string>,
  selectedFieldsById: Map<string, string | number | boolean>
): { rule: PricingRule | null; usedFallback: boolean } | null {
  const matching = context.rules.filter(
    (rule) => rule.isActive && matchesRule(rule, selectedByGroup, selectedFieldsById)
  );
  if (matching.length === 0) {
    return context.service.fallbackBehavior === 'use_base'
      ? { rule: null, usedFallback: true }
      : null;
  }

  const maxSpecificity = Math.max(
    ...matching.map((rule) =>
      rule.attributes.filter((attribute) => attribute.attributeId !== null).length
      + rule.fieldConditions.filter((condition) => condition.expectedValue !== null).length
    )
  );
  const winners = matching.filter(
    (rule) => (
      rule.attributes.filter((attribute) => attribute.attributeId !== null).length
      + rule.fieldConditions.filter((condition) => condition.expectedValue !== null).length
    ) === maxSpecificity
  );
  if (winners.length !== 1) return null;
  return { rule: winners[0]!, usedFallback: false };
}

function selectionLabel(value: string | number | boolean): string {
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

function resolveFields(
  input: PricingCalculationInput,
  context: PricingContext
): {
  snapshots: PricingFieldSnapshot[];
  effects: ServerFieldPriceEffect[];
  selectedByFieldId: Map<string, string | number | boolean>;
} | null {
  const selections = new Map<string, string | number | boolean>();
  for (const selection of input.fieldValues) {
    if (selections.has(selection.fieldKey)) return null;
    selections.set(selection.fieldKey, selection.value);
  }

  const activeFields = context.fields.filter((field) => field.isActive);
  if (Array.from(selections.keys()).some((key) => !activeFields.some((field) => field.key === key))) return null;

  const snapshots: PricingFieldSnapshot[] = [];
  const effects: ServerFieldPriceEffect[] = [];
  const selectedByFieldId = new Map<string, string | number | boolean>();
  const missingRequiredFields: typeof activeFields = [];
  for (const field of activeFields) {
    const selectedValue = selections.get(field.key);
    if (selectedValue === undefined || selectedValue === ''
        || (field.fieldType === 'checkbox' && field.isRequired && selectedValue === false)) {
      if (field.isRequired) missingRequiredFields.push(field);
      continue;
    }

    let valueLabel = selectionLabel(selectedValue);
    let priceEffect: ServerFieldPriceEffect = { type: 'none' };
    if (field.fieldType === 'select' || field.fieldType === 'radio') {
      const option = field.options.find(
        (candidate) => candidate.isActive && candidate.value === String(selectedValue)
      );
      if (!option) return null;
      valueLabel = option.label;
      priceEffect = option.priceEffect;
    } else if (field.fieldType === 'checkbox' && typeof selectedValue !== 'boolean') {
      return null;
    } else if (field.fieldType === 'number' && (
      typeof selectedValue !== 'number' || !Number.isFinite(selectedValue)
    )) {
      return null;
    } else if (
      (field.fieldType === 'text' || field.fieldType === 'textarea')
      && (typeof selectedValue !== 'string' || selectedValue.length > 5_000)
    ) {
      return null;
    }

    snapshots.push({
      fieldKey: field.key,
      fieldLabel: field.label,
      value: selectedValue,
      valueLabel,
      priceEffect,
    });
    selectedByFieldId.set(field.id, selectedValue);
    effects.push(priceEffect);
  }

  for (const field of missingRequiredFields) {
    const availability = resolveFieldOptionAvailability(
      context.fieldOptionDependencies,
      selectedByFieldId,
      field.id,
      { requireCompletePathMatch: context.service.pricingProfileConfig.requireCompleteCompatibility === true },
    );
    const checkboxUnavailable = field.fieldType === 'checkbox'
      && availability.isRestricted
      && !availability.allowedOptionValues.has('true');
    if (!checkboxUnavailable) return null;
  }

  for (const field of activeFields) {
    const selectedValue = selectedByFieldId.get(field.id);
    if (!isFieldOptionSelectionAllowed(
      context.fieldOptionDependencies,
      selectedByFieldId,
      field.id,
      selectedValue,
      { requireCompletePathMatch: context.service.pricingProfileConfig.requireCompleteCompatibility === true },
    )) return null;
  }

  return { snapshots, effects, selectedByFieldId };
}

function resolveBinding(
  input: PricingCalculationInput,
  context: PricingContext,
): { unitCents: number; totalCents: number; selections: BindingSelectionSnapshot[] } | null {
  const bindingFileIds = input.bindingFileIds ?? [];
  if (bindingFileIds.length === 0) return { unitCents: 0, totalCents: 0, selections: [] };

  const uniqueBindingIds = new Set(bindingFileIds);
  const selectedFiles = input.bindingFiles ?? [];
  const availableFileIds = new Set(input.fileIds ?? []);
  if (uniqueBindingIds.size !== bindingFileIds.length
      || bindingFileIds.some((fileId) => !availableFileIds.has(fileId))
      || selectedFiles.length !== bindingFileIds.length) {
    return null;
  }

  const filesById = new Map(selectedFiles.map((file) => [file.fileId, file]));
  if (filesById.size !== selectedFiles.length || bindingFileIds.some((fileId) => !filesById.has(fileId))) return null;

  let unitCents = 0;
  const selections: BindingSelectionSnapshot[] = [];
  for (const fileId of bindingFileIds) {
    const file = filesById.get(fileId)!;
    if (!Number.isSafeInteger(file.pageCount) || file.pageCount < 1 || file.pageCount > 1_000_000) return null;
    const tier = context.bindingTiers.find((candidate) => (
      candidate.isActive
      && candidate.minPages <= file.pageCount
      && (candidate.maxPages === null || candidate.maxPages >= file.pageCount)
    ));
    if (!tier || !Number.isSafeInteger(tier.priceCents) || tier.priceCents < 0) return null;
    unitCents += tier.priceCents;
    if (!Number.isSafeInteger(unitCents)) return null;
    selections.push({ fileId, pageCount: file.pageCount, tierId: tier.id, priceCents: tier.priceCents });
  }

  const totalCents = unitCents * input.quantity;
  if (!Number.isSafeInteger(totalCents)) return null;
  return { unitCents, totalCents, selections };
}

function profileError(message: string): PricingResult {
  return error('QUOTE_UNAVAILABLE', message);
}

function checkedAdd(left: number, right: number): number | null {
  const total = left + right;
  return Number.isSafeInteger(total) ? total : null;
}

function checkedMultiply(left: number, right: number): number | null {
  const total = left * right;
  return Number.isSafeInteger(total) ? total : null;
}

function applyBpsSafely(value: number, multiplierBps: number, mode: PricingRoundingMode): number | null {
  const numerator = checkedMultiply(value, multiplierBps);
  return numerator === null ? null : divideRounded(numerator, BPS_SCALE, mode);
}

function centimeterHundredths(value: number | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100_000) return null;
  const normalized = Math.round(value * 100);
  return Number.isSafeInteger(normalized) && normalized > 0 && Math.abs(normalized / 100 - value) < 0.000_001
    ? normalized
    : null;
}

function normalizeDimensions(profile: PricingProfile, dimensions: PricingDimensions | undefined): PricingDimensions | null {
  if (profile !== 'per_square_meter' && profile !== 'per_linear_meter') return null;
  const width = centimeterHundredths(dimensions?.widthCm);
  const height = centimeterHundredths(dimensions?.heightCm);
  const length = centimeterHundredths(dimensions?.lengthCm);
  if (profile === 'per_square_meter') {
    return width !== null && height !== null ? { widthCm: width / 100, heightCm: height / 100 } : null;
  }
  return length !== null ? { lengthCm: length / 100 } : null;
}

function resolveRateWithEffects(
  baseCents: number,
  effects: ServerFieldPriceEffect[],
  pageCount: number,
  profile: PricingProfile,
  roundingMode: PricingRoundingMode,
): { rateCents: number; extraPerUnitCents: number } | null {
  let rateCents = baseCents;
  let extraPerUnitCents = 0;
  try {
    for (const effect of effects) {
      if (effect.type === 'multiply') {
        rateCents = applyBps(rateCents, effect.multiplierBps, roundingMode);
      } else if (profile === 'per_page' && (effect.type === 'fixed' || effect.type === 'per_page')) {
        rateCents += effect.valueCents;
      } else if (effect.type === 'fixed') {
        extraPerUnitCents += effect.valueCents;
      } else if (effect.type === 'per_page') {
        const pageExtra = checkedMultiply(effect.valueCents, pageCount);
        if (pageExtra === null) return null;
        extraPerUnitCents += pageExtra;
      }
      if (!Number.isSafeInteger(rateCents) || !Number.isSafeInteger(extraPerUnitCents) || rateCents < 0 || extraPerUnitCents < 0) {
        return null;
      }
    }
  } catch {
    return null;
  }
  return { rateCents, extraPerUnitCents };
}

function bookletFileAssessmentMessage(assessment: BookletFileAssessment | undefined): string {
  switch (assessment?.status) {
    case 'multiple_files':
      return 'A cotação automática de livreto exige um único PDF completo, com miolo e capa na ordem final. Envie a capa separada apenas para análise técnica.';
    case 'file_not_pdf':
      return 'A cotação automática de livreto exige um PDF completo. Outros formatos seguem para análise técnica.';
    case 'page_count_unconfirmed':
      return 'Não foi possível confirmar com segurança as páginas do PDF. Envie o arquivo novamente ou solicite análise técnica.';
    case 'trusted':
      return 'A contagem de páginas do livreto não corresponde ao arquivo validado.';
    default:
      return 'Envie um único PDF completo para conferir a imposição do livreto.';
  }
}

type BookletComponentResult =
  | { success: true; unitCents: number; subtotalCents: number; snapshot: BookletPricingSnapshot }
  | { success: false; message: string };

/**
 * Prices a booklet as independent production layers. The matching price rule
 * is always the core rate per imposed page. Dynamic field effects must be
 * explicitly classified in the service profile, preventing a cover or staple
 * amount from being silently folded into an opaque "price per page" value.
 */
function calculateBookletComponents(
  input: PricingCalculationInput,
  context: PricingContext,
  coreRateCents: number,
  imposedPageCount: number,
  fields: PricingFieldSnapshot[],
): BookletComponentResult {
  const config = context.service.pricingProfileConfig;
  const coreKeys = config.bookletCoreFieldKeys;
  const coverKeys = config.bookletCoverFieldKeys;
  const finishingKeys = config.bookletFinishingFieldKeys;
  const coverPages = config.bookletCoverPages;
  if (!coreKeys || !coverKeys || !finishingKeys || !coverPages) {
    return { success: false, message: 'A composição de miolo, capa e acabamento deste livreto ainda não está configurada.' };
  }

  const activeFieldKeys = new Set(context.fields.filter((field) => field.isActive).map((field) => field.key));
  const configuredKeys = [...coreKeys, ...coverKeys, ...finishingKeys];
  if (configuredKeys.some((key) => !activeFieldKeys.has(key))
      || new Set(configuredKeys).size !== configuredKeys.length) {
    return { success: false, message: 'A classificação dos campos de preço do livreto está inválida.' };
  }

  const categoryByKey = new Map<string, BookletPricingComponentKind>();
  for (const key of coreKeys) categoryByKey.set(key, 'core');
  for (const key of coverKeys) categoryByKey.set(key, 'cover');
  for (const key of finishingKeys) categoryByKey.set(key, 'finishing');

  const components: BookletPricingComponent[] = [];
  let coreSubtotalCents = 0;
  let coverSubtotalCents = 0;
  let finishingSubtotalCents = 0;
  const add = (kind: BookletPricingComponentKind, label: string, quantity: number, unitCents: number): boolean => {
    const totalCents = checkedMultiply(quantity, unitCents);
    if (totalCents === null) return false;
    components.push({ kind, label, quantity, unitCents, totalCents });
    if (kind === 'core') coreSubtotalCents = checkedAdd(coreSubtotalCents, totalCents) ?? Number.NaN;
    if (kind === 'cover') coverSubtotalCents = checkedAdd(coverSubtotalCents, totalCents) ?? Number.NaN;
    if (kind === 'finishing') finishingSubtotalCents = checkedAdd(finishingSubtotalCents, totalCents) ?? Number.NaN;
    return Number.isSafeInteger(coreSubtotalCents)
      && Number.isSafeInteger(coverSubtotalCents)
      && Number.isSafeInteger(finishingSubtotalCents);
  };

  let adjustedCoreRateCents = coreRateCents;
  if (!add('core', 'Miolo — regra por página de produção', imposedPageCount, adjustedCoreRateCents)) {
    return { success: false, message: 'Cotação excede o limite monetário seguro.' };
  }

  for (const field of fields) {
    const effect = field.priceEffect;
    if (effect.type === 'none') continue;
    const kind = categoryByKey.get(field.fieldKey);
    if (!kind) {
      return { success: false, message: `O adicional de “${field.fieldLabel}” não foi classificado como miolo, capa ou acabamento.` };
    }
    const label = `${kind === 'core' ? 'Miolo' : kind === 'cover' ? 'Capa' : 'Acabamento'} — ${field.fieldLabel}: ${field.valueLabel}`;
    if (kind === 'core') {
      if (effect.type === 'multiply') {
        const previousRateCents = adjustedCoreRateCents;
        try {
          adjustedCoreRateCents = applyBps(adjustedCoreRateCents, effect.multiplierBps, context.roundingMode);
        } catch {
          return { success: false, message: 'Cotação excede o limite monetário seguro.' };
        }
        const deltaCents = adjustedCoreRateCents - previousRateCents;
        if (!add('core', label, imposedPageCount, deltaCents)) {
          return { success: false, message: 'Cotação excede o limite monetário seguro.' };
        }
      } else if (effect.type === 'per_page') {
        adjustedCoreRateCents = checkedAdd(adjustedCoreRateCents, effect.valueCents) ?? Number.NaN;
        if (!Number.isSafeInteger(adjustedCoreRateCents) || !add('core', label, imposedPageCount, effect.valueCents)) {
          return { success: false, message: 'Cotação excede o limite monetário seguro.' };
        }
      } else if (!add('core', label, 1, effect.valueCents)) {
        return { success: false, message: 'Cotação excede o limite monetário seguro.' };
      }
      continue;
    }

    if (effect.type === 'multiply') {
      return { success: false, message: `O campo “${field.fieldLabel}” usa multiplicador, permitido apenas em componentes de miolo.` };
    }
    const quantity = effect.type === 'per_page'
      ? (kind === 'cover' ? coverPages : imposedPageCount)
      : 1;
    if (!add(kind, label, quantity, effect.valueCents)) {
      return { success: false, message: 'Cotação excede o limite monetário seguro.' };
    }
  }

  const unitCents = checkedAdd(checkedAdd(coreSubtotalCents, coverSubtotalCents) ?? Number.NaN, finishingSubtotalCents);
  const amountBeforeMinimumCents = unitCents === null ? null : checkedMultiply(unitCents, input.quantity);
  if (unitCents === null || amountBeforeMinimumCents === null || unitCents < 0) {
    return { success: false, message: 'Cotação excede o limite monetário seguro.' };
  }
  const minimumRunCents = context.service.basePriceCents;
  const minimumAdjustmentCents = Math.max(0, minimumRunCents - amountBeforeMinimumCents);
  const subtotalCents = checkedAdd(amountBeforeMinimumCents, minimumAdjustmentCents);
  if (subtotalCents === null) return { success: false, message: 'Cotação excede o limite monetário seguro.' };

  return {
    success: true,
    unitCents,
    subtotalCents,
    snapshot: {
      productionPageCount: imposedPageCount,
      coverPages,
      quantity: input.quantity,
      components,
      coreSubtotalCents,
      coverSubtotalCents,
      finishingSubtotalCents,
      amountBeforeMinimumCents,
      minimumRunCents,
      minimumAdjustmentCents,
    },
  };
}

interface ProfilePrice {
  unitCents: number;
  subtotalCents: number;
  pricingUnit: string;
  dimensions: PricingDimensions | null;
  bookletPaddedPages: number | null;
  bookletImposition: BookletImpositionSnapshot | null;
  bookletPricing: BookletPricingSnapshot | null;
  printRun: PrintRunSnapshot | null;
  squareMeterPricing: SquareMeterPricingSnapshot | null;
}

function resolvePrintRunSnapshot(
  input: PricingCalculationInput,
  context: PricingContext,
  fields: PricingFieldSnapshot[],
): { success: true; snapshot: PrintRunSnapshot } | { success: false; message: string } {
  const config = context.service.pricingProfileConfig;
  if (!config.runFieldKey || !config.productionLeadTimeBusinessDays) {
    return { success: false, message: 'A configuração de tiragem deste serviço está incompleta.' };
  }

  const runField = context.fields.find((field) => field.isActive && field.key === config.runFieldKey);
  if (!runField || (runField.fieldType !== 'select' && runField.fieldType !== 'radio')) {
    return { success: false, message: 'O campo de tiragem deste serviço não está disponível.' };
  }
  const selected = fields.find((field) => field.fieldKey === runField.key);
  if (!selected || typeof selected.value !== 'string') {
    return { success: false, message: 'Selecione uma tiragem fechada para continuar.' };
  }
  const option = runField.options.find((candidate) => candidate.isActive && candidate.value === selected.value);
  if (!option || !Number.isSafeInteger(option.runQuantity) || option.runQuantity! < 1) {
    return { success: false, message: 'A tiragem selecionada não possui uma quantidade comercial válida.' };
  }
  if (option.priceEffect.type !== 'none') {
    return { success: false, message: 'A tiragem deve ser precificada por regra comercial, sem adicional na opção.' };
  }

  const totalUnits = checkedMultiply(option.runQuantity!, input.quantity);
  if (totalUnits === null) {
    return { success: false, message: 'A quantidade total da tiragem excede o limite seguro.' };
  }
  if (config.requiresArtworkFile && (input.fileIds?.length ?? 0) === 0) {
    return { success: false, message: 'Anexe a arte final para cotar esta tiragem.' };
  }
  if (config.requiresArtworkBleedAcknowledgement && !input.artworkBleedAcknowledged) {
    return { success: false, message: 'Confirme que revisou a sangria e a margem segura antes de continuar.' };
  }

  return {
    success: true,
    snapshot: {
      runFieldKey: runField.key,
      runFieldLabel: runField.label,
      runOptionValue: option.value,
      runOptionLabel: option.label,
      unitsPerRun: option.runQuantity!,
      lotCount: input.quantity,
      totalUnits,
      productionLeadTimeBusinessDays: config.productionLeadTimeBusinessDays,
      artworkFileRequired: config.requiresArtworkFile === true,
      artworkBleedAcknowledgementRequired: config.requiresArtworkBleedAcknowledgement === true,
      artworkBleedAcknowledged: input.artworkBleedAcknowledged === true,
    },
  };
}

function areasMatchWithinTolerance(
  enteredWidth: number,
  enteredHeight: number,
  pdfWidth: number,
  pdfHeight: number,
  toleranceBps: number,
): boolean {
  const matchesDimension = (entered: number, measured: number) => {
    const denominator = Math.max(entered, measured);
    return denominator > 0 && Math.abs(entered - measured) * BPS_SCALE <= denominator * toleranceBps;
  };
  return (matchesDimension(enteredWidth, pdfWidth) && matchesDimension(enteredHeight, pdfHeight))
    || (matchesDimension(enteredWidth, pdfHeight) && matchesDimension(enteredHeight, pdfWidth));
}

function dimensionReview(
  status: PdfDimensionReview['status'],
  dimensions: PricingDimensions | null,
  toleranceBps: number | null,
  measuredDimensions: PricingDimensions | null = null,
): PdfDimensionReview {
  return {
    status,
    policy: status === 'not_required' ? null : 'media_box_single_page',
    enteredDimensions: dimensions,
    measuredDimensions,
    toleranceBps,
  };
}

function pdfDimensionAssessmentMessage(status: Exclude<PdfDimensionReview['status'], 'not_required' | 'verified' | 'declared_mismatch'>): string {
  const messages: Record<typeof status, string> = {
    missing_file: 'Envie um único PDF de uma página para conferir a dimensão antes da cotação automática.',
    multiple_files: 'A cotação automática de grandes formatos aceita um único PDF por item. Separe os arquivos ou solicite análise técnica.',
    file_not_pdf: 'Para cotação automática de grandes formatos, envie um PDF. Arquivos de imagem seguem para análise técnica.',
    multiple_pages: 'Um PDF com várias páginas precisa de análise técnica antes da cotação de grande formato.',
    metadata_unavailable: 'Não foi possível confirmar as dimensões físicas do PDF. Envie novamente ou solicite análise técnica.',
    inconsistent_media_box: 'O PDF possui dimensões estruturais ambíguas e precisa de análise técnica antes da cotação.',
  };
  return messages[status];
}

function resolveProfilePrice(
  input: PricingCalculationInput,
  context: PricingContext,
  priceCents: number,
  effects: ServerFieldPriceEffect[],
  fields: PricingFieldSnapshot[],
): ProfilePrice | PricingResult {
  const profile = context.service.pricingProfile;
  const config = context.service.pricingProfileConfig;
  if (profile === 'manual_quote') return profileError('Este serviço exige orçamento técnico antes da confirmação.');

  let pagesForPricing = input.pageCount;
  let bookletPaddedPages: number | null = null;
  let bookletImposition: BookletImpositionSnapshot | null = null;
  let bookletPricing: BookletPricingSnapshot | null = null;
  let printRun: PrintRunSnapshot | null = null;
  if (profile === 'booklet_imposition') {
    const fileAssessment = input.bookletFileAssessment;
    if (!fileAssessment || fileAssessment.status !== 'trusted' || fileAssessment.pageCount !== input.pageCount) {
      return profileError(bookletFileAssessmentMessage(fileAssessment));
    }
    const minimum = config.minPages ?? 1;
    const maximum = config.maxPages ?? 1_000_000;
    const multiple = config.pageMultiple ?? 4;
    if (input.pageCount < minimum || input.pageCount > maximum) {
      return profileError(`O livreto deve ter entre ${minimum} e ${maximum} páginas.`);
    }
    const remainder = input.pageCount % multiple;
    let customerApprovalRecorded = false;
    if (remainder !== 0) {
      if (!config.allowBlankPagePadding) {
        return profileError(`O livreto precisa ter um número de páginas múltiplo de ${multiple}.`);
      }
      if (config.requiresCustomerApprovalForPadding && !input.bookletPaddingApproved) {
        return profileError(`Confirme a inclusão de páginas em branco para fechar a imposição em múltiplos de ${multiple}.`);
      }
      pagesForPricing = input.pageCount + multiple - remainder;
      bookletPaddedPages = pagesForPricing;
      customerApprovalRecorded = config.requiresCustomerApprovalForPadding === true;
    }
    bookletImposition = {
      originalPageCount: input.pageCount,
      imposedPageCount: pagesForPricing,
      blankPagesAdded: pagesForPricing - input.pageCount,
      pageMultiple: multiple,
      customerApprovalRecorded,
    };

    const calculation = calculateBookletComponents(input, context, priceCents, pagesForPricing, fields);
    if (!calculation.success) return profileError(calculation.message);
    bookletPricing = calculation.snapshot;
    return {
      unitCents: calculation.unitCents,
      subtotalCents: calculation.subtotalCents,
      pricingUnit: 'livreto finalizado',
      dimensions: null,
      bookletPaddedPages,
      bookletImposition,
      bookletPricing,
      printRun,
      squareMeterPricing: null,
    };
  }

  const rates = resolveRateWithEffects(priceCents, effects, pagesForPricing, profile, context.roundingMode);
  if (!rates) return error('INVALID_INPUT', 'Cotação excede o limite monetário seguro.');

  const create = (
    unitCents: number,
    pricingUnit: string,
    dimensions: PricingDimensions | null = null,
    squareMeterPricing: SquareMeterPricingSnapshot | null = null,
  ): ProfilePrice | PricingResult => {
    const subtotalCents = checkedMultiply(unitCents, input.quantity);
    if (unitCents < 0 || subtotalCents === null) return error('INVALID_INPUT', 'Cotação excede o limite monetário seguro.');
    return { unitCents, subtotalCents, pricingUnit, dimensions, bookletPaddedPages, bookletImposition, bookletPricing, printRun, squareMeterPricing };
  };

  if (profile === 'per_page') {
    const unitCents = checkedMultiply(rates.rateCents, pagesForPricing);
    return unitCents === null ? error('INVALID_INPUT', 'Cotação excede o limite monetário seguro.') : create(unitCents, 'página');
  }
  if (profile === 'per_item') {
    const unitCents = checkedAdd(rates.rateCents, rates.extraPerUnitCents);
    return unitCents === null ? error('INVALID_INPUT', 'Cotação excede o limite monetário seguro.') : create(unitCents, 'unidade');
  }
  if (profile === 'per_print_run') {
    const resolvedRun = resolvePrintRunSnapshot(input, context, fields);
    if (!resolvedRun.success) return profileError(resolvedRun.message);
    printRun = resolvedRun.snapshot;
    const unitCents = checkedAdd(rates.rateCents, rates.extraPerUnitCents);
    return unitCents === null ? error('INVALID_INPUT', 'Cotação excede o limite monetário seguro.') : create(unitCents, 'tiragem');
  }
  if (profile === 'per_sheet') {
    const pagesPerSheet = config.pagesPerSheet ?? 1;
    const sheets = Math.ceil(pagesForPricing / pagesPerSheet);
    const bySheets = checkedMultiply(rates.rateCents, sheets);
    const unitCents = bySheets === null ? null : checkedAdd(bySheets, rates.extraPerUnitCents);
    return unitCents === null ? error('INVALID_INPUT', 'Cotação excede o limite monetário seguro.') : create(unitCents, 'folha física');
  }
  if (profile === 'per_square_meter') {
    const dimensions = normalizeDimensions(profile, input.dimensions);
    if (!dimensions) return profileError('Informe largura e altura válidas em centímetros.');
    const width = centimeterHundredths(dimensions.widthCm)!;
    const height = centimeterHundredths(dimensions.heightCm)!;
    const minWidth = centimeterHundredths(config.minWidthCm);
    const maxWidth = centimeterHundredths(config.maxWidthCm);
    const minHeight = centimeterHundredths(config.minHeightCm);
    const maxHeight = centimeterHundredths(config.maxHeightCm);
    if ((minWidth !== null && width < minWidth) || (maxWidth !== null && width > maxWidth)
        || (minHeight !== null && height < minHeight) || (maxHeight !== null && height > maxHeight)) {
      return profileError('As dimensões estão fora da faixa configurada para este material/equipamento. Solicite orçamento técnico.');
    }
    let pdfReview = dimensionReview('not_required', dimensions, null);
    if (config.validateUploadedPdfDimensions) {
      const toleranceBps = config.pdfDimensionToleranceBps ?? 0;
      const assessment = input.pdfDimensionAssessment;
      if (config.pdfDimensionPolicy !== 'media_box_single_page') {
        return profileError('A política de dimensão do PDF não está configurada para este serviço. Solicite orçamento técnico.');
      }
      if (!assessment || assessment.policy !== 'media_box_single_page' || assessment.status !== 'trusted' || !assessment.dimension) {
        const status = assessment?.status === 'trusted' ? 'metadata_unavailable' : assessment?.status ?? 'metadata_unavailable';
        const review = dimensionReview(status, dimensions, toleranceBps);
        return error('QUOTE_UNAVAILABLE', pdfDimensionAssessmentMessage(status), review);
      }
      const uploaded = assessment.dimension;
      if (centimeterHundredths(uploaded.widthCm) === null || centimeterHundredths(uploaded.heightCm) === null) {
        const review = dimensionReview('metadata_unavailable', dimensions, toleranceBps);
        return error('QUOTE_UNAVAILABLE', pdfDimensionAssessmentMessage('metadata_unavailable'), review);
      }
      const measuredDimensions = { widthCm: uploaded.widthCm, heightCm: uploaded.heightCm };
      if (!areasMatchWithinTolerance(
        dimensions.widthCm!,
        dimensions.heightCm!,
        uploaded.widthCm,
        uploaded.heightCm,
        toleranceBps,
      )) {
        const review = dimensionReview('declared_mismatch', dimensions, toleranceBps, measuredDimensions);
        return error('QUOTE_UNAVAILABLE', 'As dimensões informadas divergem da MediaBox do PDF enviado. Corrija a medida ou solicite análise técnica.', review);
      }
      pdfReview = dimensionReview('verified', dimensions, toleranceBps, measuredDimensions);
    }
    const submittedAreaRaw = checkedMultiply(width, height);
    const minimumAreaRaw = checkedMultiply(config.minimumBillableAreaCm2 ?? 0, 10_000);
    if (submittedAreaRaw === null || minimumAreaRaw === null) return error('INVALID_INPUT', 'Cotação excede o limite técnico seguro.');
    const areaBeforeWasteRaw = Math.max(submittedAreaRaw, minimumAreaRaw);
    const billedAreaRaw = applyBpsSafely(areaBeforeWasteRaw, BPS_SCALE + (config.wasteMarginBps ?? 0), context.roundingMode);
    if (billedAreaRaw === null) return error('INVALID_INPUT', 'Cotação excede o limite técnico seguro.');
    const numerator = checkedMultiply(rates.rateCents, billedAreaRaw);
    if (numerator === null) return error('INVALID_INPUT', 'Cotação excede o limite monetário seguro.');
    const byArea = divideRounded(numerator, 100_000_000, context.roundingMode);
    const unitCents = checkedAdd(byArea, rates.extraPerUnitCents);
    const squareMeterPricing: SquareMeterPricingSnapshot = {
      submittedAreaCm2: submittedAreaRaw / 10_000,
      minimumBillableAreaCm2: config.minimumBillableAreaCm2 ?? 0,
      areaBeforeWasteCm2: areaBeforeWasteRaw / 10_000,
      wasteMarginBps: config.wasteMarginBps ?? 0,
      billableAreaCm2: billedAreaRaw / 10_000,
      rateCentsPerSquareMeter: rates.rateCents,
      additionsCentsPerUnit: rates.extraPerUnitCents,
      dimensionReview: pdfReview,
    };
    return unitCents === null
      ? error('INVALID_INPUT', 'Cotação excede o limite monetário seguro.')
      : create(unitCents, 'metro quadrado', dimensions, squareMeterPricing);
  }
  if (profile === 'per_linear_meter') {
    const dimensions = normalizeDimensions(profile, input.dimensions);
    if (!dimensions) return profileError('Informe o comprimento válido em centímetros.');
    const length = centimeterHundredths(dimensions.lengthCm)!;
    const numerator = checkedMultiply(rates.rateCents, length);
    if (numerator === null) return error('INVALID_INPUT', 'Cotação excede o limite monetário seguro.');
    const byLength = divideRounded(numerator, 10_000, context.roundingMode);
    const unitCents = checkedAdd(byLength, rates.extraPerUnitCents);
    return unitCents === null ? error('INVALID_INPUT', 'Cotação excede o limite monetário seguro.') : create(unitCents, 'metro linear', dimensions);
  }
  if (profile === 'binding_by_file_pages') {
    return create(0, 'arquivo encadernado');
  }
  return profileError('Perfil técnico de cobrança indisponível.');
}

export function calculatePrice(input: PricingCalculationInput, context: PricingContext): PricingResult {
  if (input.serviceId !== context.service.id) return error('QUOTE_UNAVAILABLE', 'Serviço indisponível.');
  if (!Number.isSafeInteger(input.pageCount) || input.pageCount < 1 || input.pageCount > 1_000_000) {
    return error('INVALID_INPUT', 'Quantidade de páginas inválida.');
  }
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 100_000_000) {
    return error('INVALID_INPUT', 'Quantidade inválida.');
  }

  const uniqueAttributeIds = new Set(input.attributeIds);
  if (uniqueAttributeIds.size !== input.attributeIds.length) {
    return error('INVALID_INPUT', 'Atributos duplicados.');
  }

  const activeAttributes = new Map(
    context.attributes.filter((attribute) => attribute.isActive).map((attribute) => [attribute.id, attribute])
  );
  const selectedByGroup = new Map<string, string>();
  for (const attributeId of input.attributeIds) {
    const attribute = activeAttributes.get(attributeId);
    if (!attribute || selectedByGroup.has(attribute.groupId)) {
      return error('QUOTE_UNAVAILABLE', 'Configuração de atributos indisponível.');
    }
    selectedByGroup.set(attribute.groupId, attribute.id);
  }

  const resolvedFields = resolveFields(input, context);
  if (!resolvedFields) return error('QUOTE_UNAVAILABLE', 'Configuração de serviço inválida ou inativa.');
  const profile = context.service.pricingProfile;
  if (profile === 'manual_quote') {
    return error('QUOTE_UNAVAILABLE', 'Este serviço exige orçamento técnico antes da confirmação.');
  }
  const resolvedRule = profile === 'binding_by_file_pages'
    ? { rule: null, usedFallback: true }
    : resolveRule(context, selectedByGroup, resolvedFields.selectedByFieldId);
  if (!resolvedRule) return error('QUOTE_UNAVAILABLE', 'Regra de preço ausente ou ambígua.');

  const rule = resolvedRule.rule;
  if (profile === 'booklet_imposition' && !rule) {
    return error('QUOTE_UNAVAILABLE', 'Livreto exige uma regra específica para definir o preço do miolo por página de produção.');
  }
  const pricePerPageCents = rule?.pricePerPageCents ?? context.service.basePriceCents;
  if (!Number.isSafeInteger(pricePerPageCents) || pricePerPageCents < 0) {
    return error('QUOTE_UNAVAILABLE', 'Preço do serviço inválido.');
  }

  let profilePrice = resolveProfilePrice(input, context, pricePerPageCents, resolvedFields.effects, resolvedFields.snapshots);
  if ('success' in profilePrice) return profilePrice;

  if (input.isFrontAndBack && profile === 'per_page') {
    const doubledUnit = applyBps(profilePrice.unitCents, context.doubleSidedMultiplierBps, context.roundingMode);
    const doubledSubtotal = checkedMultiply(doubledUnit, input.quantity);
    if (doubledSubtotal === null) return error('INVALID_INPUT', 'Cotação excede o limite monetário seguro.');
    profilePrice = { ...profilePrice, unitCents: doubledUnit, subtotalCents: doubledSubtotal };
  }

  const binding = resolveBinding(input, context);
  if (!binding) return error('QUOTE_UNAVAILABLE', 'Encadernação indisponível para um ou mais arquivos selecionados.');
  if (profile === 'binding_by_file_pages' && binding.selections.length === 0) {
    return error('QUOTE_UNAVAILABLE', 'Selecione ao menos um arquivo para encadernação.');
  }

  const primaryUnitCents = profile === 'binding_by_file_pages' ? 0 : profilePrice.unitCents;
  const primarySubtotalCents = profile === 'binding_by_file_pages' ? 0 : profilePrice.subtotalCents;
  const unitPriceCents = checkedAdd(primaryUnitCents, binding.unitCents);
  const subtotalBeforeDiscountCents = checkedAdd(primarySubtotalCents, binding.totalCents);
  if (unitPriceCents === null || subtotalBeforeDiscountCents === null) {
    return error('INVALID_INPUT', 'Cotação excede o limite monetário seguro.');
  }

  const applicableDiscounts = context.discounts.filter((discount) =>
    discount.minQuantity <= input.quantity
    && (discount.maxQuantity === null || discount.maxQuantity >= input.quantity)
  );
  if (applicableDiscounts.length > 1) {
    return error('QUOTE_UNAVAILABLE', 'Faixas de desconto ambíguas.');
  }

  const discountBps = applicableDiscounts[0]?.discountBps ?? 0;
  // O acabamento por arquivo não recebe desconto automático; todos os outros
  // perfis usam a unidade técnica configurada pelo administrador.
  const discountBaseCents = profile === 'binding_by_file_pages' ? 0 : primarySubtotalCents;
  const discountCents = applyBps(discountBaseCents, discountBps, context.roundingMode);
  const totalCents = subtotalBeforeDiscountCents - discountCents;

  return {
    success: true,
    data: {
      serviceSnapshot: {
        id: context.service.id,
        name: context.service.name,
        description: context.service.description,
        pricingVersion: context.service.pricingVersion,
        catalogVersion: context.service.catalogVersion,
        pricingProfile: context.service.pricingProfile,
        pricingProfileConfig: context.service.pricingProfileConfig,
      },
      ruleId: rule?.id ?? null,
      ruleName: rule?.name ?? 'Preço-base autorizado',
      ruleVersion: rule?.version ?? null,
      pricePerPageCents,
      pricingUnit: profile === 'binding_by_file_pages' ? 'arquivo encadernado' : profilePrice.pricingUnit,
      dimensions: profilePrice.dimensions,
      squareMeterPricing: profilePrice.squareMeterPricing,
      bookletPaddedPages: profilePrice.bookletPaddedPages,
      bookletImposition: profilePrice.bookletImposition,
      bookletPricing: profilePrice.bookletPricing,
      printRun: profilePrice.printRun,
      unitPriceCents,
      subtotalBeforeDiscountCents,
      discountBps,
      discountCents,
      totalCents,
      bindingUnitCents: binding.unitCents,
      bindingTotalCents: binding.totalCents,
      bindingSelections: binding.selections,
      fieldsSnapshot: resolvedFields.snapshots,
      attributeIdsSnapshot: [...input.attributeIds],
      pageCount: input.pageCount,
      quantity: input.quantity,
      isFrontAndBack: input.isFrontAndBack,
      doubleSidedMultiplierBps: context.doubleSidedMultiplierBps,
      roundingMode: context.roundingMode,
      isEstimate: false,
      usedFallback: resolvedRule.usedFallback,
    },
  };
}
