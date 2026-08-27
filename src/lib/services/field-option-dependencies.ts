export interface FieldOptionDependency {
  sourceFieldId: string;
  sourceOptionValue: string;
  sourceConditions?: FieldOptionCondition[];
  targetFieldId: string;
  targetOptionValue: string;
}

export interface FieldOptionCondition {
  fieldId: string;
  optionValue: string;
}

export type FieldSelectionMap = ReadonlyMap<string, string | number | boolean>;

export interface FieldOptionAvailability {
  /** True only when at least one selected source option restricts this target. */
  isRestricted: boolean;
  allowedOptionValues: ReadonlySet<string>;
}

export interface FieldOptionAvailabilityOptions {
  /**
   * With strict compatibility enabled, selecting an antecedent that has no
   * configured path makes the target unavailable. This turns the saved tree
   * into an allow-list while preserving the incremental editor by default.
   */
  requireCompletePathMatch?: boolean;
}

function asComparableOptionValue(value: string | number | boolean | undefined): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return String(value);
  return null;
}

function conditionsFor(dependency: FieldOptionDependency): FieldOptionCondition[] {
  if (dependency.sourceConditions && dependency.sourceConditions.length > 0) {
    return dependency.sourceConditions;
  }
  return [{
    fieldId: dependency.sourceFieldId,
    optionValue: dependency.sourceOptionValue,
  }];
}

function conditionFieldSetKey(conditions: readonly FieldOptionCondition[]): string {
  return conditions.map((condition) => condition.fieldId).sort().join('|');
}

/**
 * Resolves the allow-list for a target field. A path only applies when every
 * one of its antecedents is selected. Independent paths continue to narrow
 * their target by intersection, preserving the behavior of the old pair links.
 * A path whose antecedents are incomplete or do not match intentionally imposes
 * no restriction, allowing incremental administrative configuration.
 */
export function resolveFieldOptionAvailability(
  dependencies: readonly FieldOptionDependency[],
  selectedByFieldId: FieldSelectionMap,
  targetFieldId: string,
  options: FieldOptionAvailabilityOptions = {},
): FieldOptionAvailability {
  const targetDependencies = dependencies.filter((dependency) => dependency.targetFieldId === targetFieldId);
  const groups = new Map<string, FieldOptionDependency[]>();
  for (const dependency of targetDependencies) {
    const key = conditionFieldSetKey(conditionsFor(dependency));
    groups.set(key, [...(groups.get(key) ?? []), dependency]);
  }

  let allowed: Set<string> | null = null;
  for (const group of groups.values()) {
    const firstDependency = group[0];
    if (!firstDependency) continue;
    const conditions = conditionsFor(firstDependency);
    const hasEveryConditionSelected = conditions.every((condition) => (
      asComparableOptionValue(selectedByFieldId.get(condition.fieldId)) !== null
    ));
    if (!hasEveryConditionSelected) continue;

    const matches = group.filter((dependency) => conditionsFor(dependency).every((condition) => (
      asComparableOptionValue(selectedByFieldId.get(condition.fieldId)) === condition.optionValue
    )));
    if (matches.length === 0) {
      if (options.requireCompletePathMatch) {
        allowed = new Set<string>();
      }
      continue;
    }

    const allowedForSource = new Set(matches.map((dependency) => dependency.targetOptionValue));
    if (allowed === null) {
      allowed = allowedForSource;
    } else {
      const previousAllowed: ReadonlySet<string> = allowed;
      allowed = new Set([...previousAllowed].filter((optionValue: string) => allowedForSource.has(optionValue)));
    }
  }

  return {
    isRestricted: allowed !== null,
    allowedOptionValues: allowed ?? new Set<string>(),
  };
}

export function isFieldOptionSelectionAllowed(
  dependencies: readonly FieldOptionDependency[],
  selectedByFieldId: FieldSelectionMap,
  targetFieldId: string,
  selectedValue: string | number | boolean | undefined,
  options: FieldOptionAvailabilityOptions = {},
): boolean {
  if (asComparableOptionValue(selectedValue) === null) return true;
  const availability = resolveFieldOptionAvailability(dependencies, selectedByFieldId, targetFieldId, options);
  return !availability.isRestricted || availability.allowedOptionValues.has(asComparableOptionValue(selectedValue)!);
}
