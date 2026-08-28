import {
  isFieldOptionSelectionAllowed,
  type FieldOptionCondition,
  type FieldOptionDependency,
} from '@/lib/services/field-option-dependencies';

export type CatalogFieldValue = string | boolean | undefined;

export interface CoverageField {
  id: string;
  fieldType: string;
  isRequired: boolean;
  isActive: boolean;
  options: Array<{ value: string; isActive: boolean }>;
}

export interface CoverageRule {
  id: string;
  hasAttributeConditions: boolean;
  fieldConditions: Array<{ serviceFieldId: string; expectedValue: CatalogFieldValue | number | null }>;
}

export interface CatalogCoverage {
  inspectedCombinations: number;
  validCombinations: number;
  uncoveredCombinations: number;
  fallbackCombinations: number;
  ambiguousCombinations: number;
  limited: boolean;
  unsupportedRuleFieldIds: string[];
  rulesWithLegacyAttributes: number;
}

const MAX_COMBINATIONS = 10_000;

function valuesForField(field: CoverageField): CatalogFieldValue[] | null {
  if (!field.isActive) return [];

  if (field.fieldType === 'select' || field.fieldType === 'radio') {
    const values = field.options.filter((option) => option.isActive).map((option) => option.value);
    return field.isRequired ? values : [undefined, ...values];
  }

  if (field.fieldType === 'checkbox') {
    // Required checkboxes are only valid as true. A required checkbox can be
    // omitted solely when compatibility explicitly makes it unavailable.
    return field.isRequired ? [undefined, true] : [undefined, false, true];
  }

  // Text and number fields are intentionally not enumerable. They can still
  // coexist with automatic pricing as long as no price rule tries to price a
  // particular free-form value.
  return null;
}

function dependenciesFor(
  rawDependencies: readonly {
    sourceFieldId: string;
    sourceOptionValue: string;
    sourceConditions?: readonly { fieldId: string; optionValue: string }[] | null;
    targetFieldId: string;
    targetOptionValue: string;
  }[],
): FieldOptionDependency[] {
  return rawDependencies.map((dependency) => ({
    sourceFieldId: dependency.sourceFieldId,
    sourceOptionValue: dependency.sourceOptionValue,
    ...(dependency.sourceConditions
      ? {
        sourceConditions: dependency.sourceConditions.map((condition): FieldOptionCondition => ({
          fieldId: condition.fieldId,
          optionValue: condition.optionValue,
        })),
      }
      : {}),
    targetFieldId: dependency.targetFieldId,
    targetOptionValue: dependency.targetOptionValue,
  }));
}

function ruleMatches(rule: CoverageRule, selection: ReadonlyMap<string, string | boolean>): boolean {
  if (rule.hasAttributeConditions) return false;
  return rule.fieldConditions.every((condition) => (
    condition.expectedValue === null
      || selection.get(condition.serviceFieldId) === condition.expectedValue
  ));
}

function ruleSpecificity(rule: CoverageRule): number {
  return rule.fieldConditions.filter((condition) => condition.expectedValue !== null).length;
}

/**
 * Enumerates only configurations the server accepts. Compatibility is applied
 * to complete selections, matching the final server-side validation rather
 * than the incremental UI state. A finite cap deliberately fails closed at
 * publication time instead of asserting coverage that was not inspected.
 */
export function inspectCatalogCoverage(
  fields: readonly CoverageField[],
  rawDependencies: readonly {
    sourceFieldId: string;
    sourceOptionValue: string;
    sourceConditions?: readonly { fieldId: string; optionValue: string }[] | null;
    targetFieldId: string;
    targetOptionValue: string;
  }[],
  rules: readonly CoverageRule[],
  options: { requireCompleteCompatibility: boolean; fallbackBehavior: 'block' | 'use_base' },
): CatalogCoverage {
  const selectableFields = fields
    .filter((field) => field.isActive)
    .map((field) => ({ field, values: valuesForField(field) }))
    .filter((entry): entry is { field: CoverageField; values: CatalogFieldValue[] } => entry.values !== null);
  const enumerableFieldIds = new Set(selectableFields.map(({ field }) => field.id));
  const unsupportedRuleFieldIds = Array.from(new Set(
    rules.flatMap((rule) => rule.fieldConditions)
      .filter((condition) => condition.expectedValue !== null && !enumerableFieldIds.has(condition.serviceFieldId))
      .map((condition) => condition.serviceFieldId),
  ));
  const rulesWithLegacyAttributes = rules.filter((rule) => rule.hasAttributeConditions).length;

  let possibleCombinations = 1;
  for (const { values } of selectableFields) {
    possibleCombinations *= values.length;
    if (possibleCombinations > MAX_COMBINATIONS) {
      return {
        inspectedCombinations: 0,
        validCombinations: 0,
        uncoveredCombinations: 0,
        fallbackCombinations: 0,
        ambiguousCombinations: 0,
        limited: true,
        unsupportedRuleFieldIds,
        rulesWithLegacyAttributes,
      };
    }
  }

  const dependencies = dependenciesFor(rawDependencies);
  const coverage: CatalogCoverage = {
    inspectedCombinations: 0,
    validCombinations: 0,
    uncoveredCombinations: 0,
    fallbackCombinations: 0,
    ambiguousCombinations: 0,
    limited: false,
    unsupportedRuleFieldIds,
    rulesWithLegacyAttributes,
  };

  function visit(index: number, selection: Map<string, string | boolean>): void {
    if (index < selectableFields.length) {
      const { field, values } = selectableFields[index]!;
      for (const value of values) {
        if (value === undefined) selection.delete(field.id);
        else selection.set(field.id, value);
        visit(index + 1, selection);
      }
      selection.delete(field.id);
      return;
    }

    for (const { field } of selectableFields) {
      const value = selection.get(field.id);
      if (!isFieldOptionSelectionAllowed(dependencies, selection, field.id, value, {
        requireCompletePathMatch: options.requireCompleteCompatibility,
      })) return;

      if (field.isRequired && field.fieldType === 'checkbox' && value === undefined) {
        // The price engine permits a missing required checkbox only if the
        // dependency tree explicitly removes the affirmative option.
        const trueAllowed = isFieldOptionSelectionAllowed(dependencies, selection, field.id, true, {
          requireCompletePathMatch: options.requireCompleteCompatibility,
        });
        if (trueAllowed) return;
      }
    }

    coverage.inspectedCombinations += 1;
    coverage.validCombinations += 1;
    const matching = rules.filter((rule) => ruleMatches(rule, selection));
    if (matching.length === 0) {
      if (options.fallbackBehavior === 'block') coverage.uncoveredCombinations += 1;
      else coverage.fallbackCombinations += 1;
      return;
    }
    const highestSpecificity = Math.max(...matching.map(ruleSpecificity));
    if (matching.filter((rule) => ruleSpecificity(rule) === highestSpecificity).length !== 1) {
      coverage.ambiguousCombinations += 1;
    }
  }

  visit(0, new Map());
  return coverage;
}
