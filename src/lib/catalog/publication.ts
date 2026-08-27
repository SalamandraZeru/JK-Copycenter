import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/supabase';
import type { PricingProfile } from '@/types/pricing';

export type CatalogState = 'draft' | 'review' | 'published' | 'inactive';

export interface ServicePublicationCandidate {
  name: string;
  slug: string;
  basePriceCents: number;
  fallbackBehavior: string;
  pricingProfile?: PricingProfile;
  state: CatalogState;
}

export interface CatalogReadiness {
  ready: boolean;
  errors: string[];
  warnings: string[];
  coverage: {
    inspectedCombinations: number;
    uncoveredCombinations: number;
    ambiguousCombinations: number;
    limited: boolean;
  };
}

function optionValues(value: Json): string[] | null {
  if (!Array.isArray(value)) return [];
  const values: string[] = [];
  for (const option of value) {
    if (!option || typeof option !== 'object' || Array.isArray(option)) return null;
    const record = option as Record<string, Json | undefined>;
    if (record.is_active === false) continue;
    if (typeof record.value !== 'string' || record.value.trim() === '') return null;
    values.push(record.value);
  }
  return values;
}

function ruleSignature(rule: {
  pricing_rule_attributes: Array<{ attribute_id: string | null; attribute_group_id: string }> | null;
  pricing_rule_field_conditions: Array<{ service_field_id: string; expected_value: Json }> | null;
}): string {
  const attributes = (rule.pricing_rule_attributes ?? [])
    .map((attribute) => `${attribute.attribute_group_id}:${attribute.attribute_id ?? '*'}`)
    .sort();
  const fields = (rule.pricing_rule_field_conditions ?? [])
    .map((condition) => `${condition.service_field_id}:${JSON.stringify(condition.expected_value)}`)
    .sort();
  return JSON.stringify({ attributes, fields });
}

/**
 * Checks only structural catalog guarantees. It intentionally does not invent
 * commercial prices or infer which combinations a printer can manufacture.
 */
export async function inspectServicePublication(
  supabase: SupabaseClient<Database>,
  serviceId: string,
  candidate: ServicePublicationCandidate,
): Promise<CatalogReadiness> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const coverage = {
    inspectedCombinations: 0,
    uncoveredCombinations: 0,
    ambiguousCombinations: 0,
    limited: false,
  };

  if (!candidate.name.trim()) errors.push('O serviço precisa ter um nome.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate.slug)) {
    errors.push('O slug do serviço é inválido.');
  }
  if (!Number.isSafeInteger(candidate.basePriceCents) || candidate.basePriceCents < 0) {
    errors.push('O preço-base do serviço é inválido.');
  }

  const [fieldsResult, rulesResult, bindingTiersResult] = await Promise.all([
    supabase
      .from('service_fields')
      .select('id, key, label, field_type, options, is_required, is_active')
      .eq('service_id', serviceId),
    supabase
      .from('pricing_rules')
      .select(`
        id,
        is_active,
        pricing_rule_attributes (attribute_id, attribute_group_id),
        pricing_rule_field_conditions (service_field_id, expected_value)
      `)
      .eq('service_id', serviceId)
      .eq('is_active', true),
    supabase
      .from('service_binding_price_tiers')
      .select('id')
      .eq('service_id', serviceId)
      .eq('is_active', true),
  ]);

  if (fieldsResult.error || rulesResult.error || bindingTiersResult.error) {
    return {
      ready: false,
      errors: ['Não foi possível validar os campos e regras do serviço.'],
      warnings,
      coverage,
    };
  }

  const activeKeys = new Set<string>();
  const selectableFields: Array<{ id: string; values: string[] }> = [];
  for (const field of fieldsResult.data ?? []) {
    if (!field.is_active) continue;
    const key = field.key.trim();
    if (activeKeys.has(key)) errors.push(`A chave de campo “${key}” está duplicada.`);
    activeKeys.add(key);

    if (field.field_type === 'select' || field.field_type === 'radio') {
      const values = optionValues(field.options);
      if (!values) {
        errors.push(`O campo “${field.label}” possui uma opção inválida.`);
        continue;
      }
      if (field.is_required && values.length === 0) {
        errors.push(`O campo obrigatório “${field.label}” não possui opções ativas.`);
      }
      if (new Set(values).size !== values.length) {
        errors.push(`O campo “${field.label}” possui valores internos de opção duplicados.`);
      }
      if (field.is_required && values.length > 0) selectableFields.push({ id: field.id, values });
    }
  }

  const activeRules = rulesResult.data ?? [];
  const signatures = new Set<string>();
  for (const rule of activeRules) {
    const signature = ruleSignature(rule);
    if (signatures.has(signature)) {
      errors.push('Existem regras de preço ativas com a mesma combinação de condições.');
      break;
    }
    signatures.add(signature);
  }

  const combinationCount = selectableFields.reduce((total, field) => total * field.values.length, 1);
  if (selectableFields.length > 0 && combinationCount <= 256) {
    const combinations: Array<Map<string, string>> = [new Map()];
    for (const field of selectableFields) {
      const next: Array<Map<string, string>> = [];
      for (const combination of combinations) {
        for (const value of field.values) {
          const selection = new Map(combination);
          selection.set(field.id, value);
          next.push(selection);
        }
      }
      combinations.splice(0, combinations.length, ...next);
    }
    coverage.inspectedCombinations = combinations.length;
    for (const combination of combinations) {
      const matching = activeRules.filter((rule) => (
        // Attribute rules cannot be proven covered from service-only options.
        // They remain available for the engine, but need manual review here.
        (rule.pricing_rule_attributes ?? []).length === 0
        && (rule.pricing_rule_field_conditions ?? []).every((condition) => (
          condition.expected_value === null
          || combination.get(condition.service_field_id) === condition.expected_value
        ))
      ));
      if (matching.length === 0) coverage.uncoveredCombinations += 1;
      const specificities = matching.map((rule) => (
        (rule.pricing_rule_field_conditions ?? []).filter((condition) => condition.expected_value !== null).length
      ));
      const highest = specificities.length > 0 ? Math.max(...specificities) : -1;
      if (specificities.filter((specificity) => specificity === highest).length > 1) {
        coverage.ambiguousCombinations += 1;
      }
    }
  } else if (combinationCount > 256) {
    coverage.limited = true;
  }

  if (coverage.ambiguousCombinations > 0) {
    errors.push(`${coverage.ambiguousCombinations} combinação(ões) de campos possuem mais de uma regra vencedora.`);
  }
  if (coverage.uncoveredCombinations > 0) {
    const message = `${coverage.uncoveredCombinations} combinação(ões) de campos não possuem regra específica.`;
    if (candidate.fallbackBehavior === 'block') warnings.push(`${message} A cotação será bloqueada com segurança.`);
    else warnings.push(`${message} Elas usarão o preço-base explicitamente configurado.`);
  }
  if (coverage.limited) {
    warnings.push('Há mais de 256 combinações de campos; revise a cobertura de regras pelo painel de preços.');
  }

  if (candidate.state === 'published') {
    const isManualQuote = candidate.pricingProfile === 'manual_quote';
    const isBindingByFile = candidate.pricingProfile === 'binding_by_file_pages';
    if (isBindingByFile && (bindingTiersResult.data?.length ?? 0) === 0) {
      errors.push('A encadernação por arquivo exige ao menos uma faixa de preço ativa.');
    }
    if (!isManualQuote && !isBindingByFile && candidate.fallbackBehavior === 'block' && activeRules.length === 0) {
      errors.push('A publicação exige uma regra ativa quando o fallback bloqueia a cotação.');
    }
    if (!isManualQuote && !isBindingByFile && candidate.fallbackBehavior === 'use_base' && candidate.basePriceCents === 0 && activeRules.length === 0) {
      errors.push('A publicação exige preço-base maior que zero ou uma regra de preço ativa.');
    }
    if (candidate.fallbackBehavior !== 'block' && candidate.fallbackBehavior !== 'use_base') {
      errors.push('O comportamento de fallback de preço é inválido.');
    }
    if (isManualQuote) {
      warnings.push('Este serviço publicado exige orçamento técnico; não haverá preço automático no carrinho.');
    } else if (isBindingByFile) {
      warnings.push('Este serviço cobra somente pelos arquivos escolhidos para encadernação.');
    } else if (activeRules.length === 0 && candidate.fallbackBehavior === 'use_base') {
      warnings.push('O serviço publicado usa o preço-base para todas as configurações válidas.');
    }
  }

  return { ready: errors.length === 0, errors, warnings, coverage };
}
