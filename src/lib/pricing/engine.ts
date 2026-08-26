import type {
  BindingSelectionSnapshot,
  PricingCalculationInput,
  PricingContext,
  PricingFieldSnapshot,
  PricingResult,
  PricingRoundingMode,
  PricingRule,
  ServerFieldPriceEffect,
} from '@/types/pricing';
import { isFieldOptionSelectionAllowed, resolveFieldOptionAvailability } from '@/lib/services/field-option-dependencies';

const BPS_SCALE = 10_000;

function error(code: 'QUOTE_UNAVAILABLE' | 'INVALID_INPUT', message: string): PricingResult {
  return { success: false, error: { code, message } };
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
    if (selectedValue === undefined || selectedValue === '') {
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
  const resolvedRule = resolveRule(context, selectedByGroup, resolvedFields.selectedByFieldId);
  if (!resolvedRule) return error('QUOTE_UNAVAILABLE', 'Regra de preço ausente ou ambígua.');

  const rule = resolvedRule.rule;
  const pricePerPageCents = rule?.pricePerPageCents ?? context.service.basePriceCents;
  if (!Number.isSafeInteger(pricePerPageCents) || pricePerPageCents < 0) {
    return error('QUOTE_UNAVAILABLE', 'Preço do serviço inválido.');
  }

  let perPageCents = pricePerPageCents;
  try {
    for (const effect of resolvedFields.effects) {
      if (effect.type === 'fixed' || effect.type === 'per_page') {
        perPageCents += effect.valueCents;
      } else if (effect.type === 'multiply') {
        perPageCents = applyBps(perPageCents, effect.multiplierBps, context.roundingMode);
      }
    }
    if (input.isFrontAndBack) {
      perPageCents = applyBps(perPageCents, context.doubleSidedMultiplierBps, context.roundingMode);
    }
  } catch {
    return error('INVALID_INPUT', 'Cotação excede o limite monetário seguro.');
  }

  const printUnitPriceCents = perPageCents * input.pageCount;
  const printSubtotalCents = printUnitPriceCents * input.quantity;
  if (!Number.isSafeInteger(printSubtotalCents)) {
    return error('INVALID_INPUT', 'Cotação excede o limite monetário seguro.');
  }

  const binding = resolveBinding(input, context);
  if (!binding) return error('QUOTE_UNAVAILABLE', 'Encadernação indisponível para um ou mais arquivos selecionados.');
  const unitPriceCents = printUnitPriceCents + binding.unitCents;
  const subtotalBeforeDiscountCents = printSubtotalCents + binding.totalCents;
  if (!Number.isSafeInteger(unitPriceCents) || !Number.isSafeInteger(subtotalBeforeDiscountCents)) {
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
  // Descontos de volume continuam incidindo somente na impressão. A
  // encadernação é um acabamento físico cobrado por cópia e arquivo.
  const discountCents = applyBps(printSubtotalCents, discountBps, context.roundingMode);
  const totalCents = subtotalBeforeDiscountCents - discountCents;

  return {
    success: true,
    data: {
      serviceSnapshot: {
        id: context.service.id,
        name: context.service.name,
        description: context.service.description,
        pricingVersion: context.service.pricingVersion,
      },
      ruleId: rule?.id ?? null,
      ruleName: rule?.name ?? 'Preço-base autorizado',
      ruleVersion: rule?.version ?? null,
      pricePerPageCents,
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
