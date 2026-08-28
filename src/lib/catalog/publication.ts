import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/supabase';
import type { PricingProfile } from '@/types/pricing';
import { normalizePricingProfileConfig } from '@/lib/pricing/profiles';
import { inspectCatalogCoverage } from './coverage';

export type CatalogState = 'draft' | 'review' | 'published' | 'inactive';

export interface ServicePublicationCandidate {
  name: string;
  slug: string;
  basePriceCents: number;
  fallbackBehavior: string;
  pricingProfile?: PricingProfile;
  pricingProfileConfig?: Json;
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

function optionValues(value: Json): Array<{ value: string; isActive: boolean }> | null {
  if (!Array.isArray(value)) return [];
  const values: Array<{ value: string; isActive: boolean }> = [];
  for (const option of value) {
    if (!option || typeof option !== 'object' || Array.isArray(option)) return null;
    const record = option as Record<string, Json | undefined>;
    if (typeof record.value !== 'string' || record.value.trim() === '') return null;
    values.push({ value: record.value, isActive: record.is_active !== false });
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

  const [fieldsResult, rulesResult, bindingTiersResult, dependenciesResult] = await Promise.all([
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
    supabase
      .from('service_field_option_dependencies')
      .select('source_field_id, source_option_value, source_conditions, target_field_id, target_option_value')
      .eq('service_id', serviceId),
  ]);

  if (fieldsResult.error || rulesResult.error || bindingTiersResult.error || dependenciesResult.error) {
    return {
      ready: false,
      errors: ['Não foi possível validar os campos e regras do serviço.'],
      warnings,
      coverage,
    };
  }

  const activeKeys = new Set<string>();
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
      const activeValues = values.filter((option) => option.isActive).map((option) => option.value);
      if (field.is_required && activeValues.length === 0) {
        errors.push(`O campo obrigatório “${field.label}” não possui opções ativas.`);
      }
      if (new Set(values.map((option) => option.value)).size !== values.length) {
        errors.push(`O campo “${field.label}” possui valores internos de opção duplicados.`);
      }
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

  const technicalConfig = normalizePricingProfileConfig(candidate.pricingProfileConfig ?? {});
  const computedCoverage = inspectCatalogCoverage(
    (fieldsResult.data ?? []).map((field) => ({
      id: field.id,
      fieldType: field.field_type,
      isRequired: field.is_required,
      isActive: field.is_active,
      options: optionValues(field.options) ?? [],
    })),
    (dependenciesResult.data ?? []).map((dependency) => ({
      sourceFieldId: dependency.source_field_id,
      sourceOptionValue: dependency.source_option_value,
      sourceConditions: Array.isArray(dependency.source_conditions)
        ? dependency.source_conditions.flatMap((condition) => {
          if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return [];
          const value = condition as Record<string, Json | undefined>;
          return typeof value.field_id === 'string' && typeof value.option_value === 'string'
            ? [{ fieldId: value.field_id, optionValue: value.option_value }]
            : [];
        })
        : [{ fieldId: dependency.source_field_id, optionValue: dependency.source_option_value }],
      targetFieldId: dependency.target_field_id,
      targetOptionValue: dependency.target_option_value,
    })),
    activeRules.map((rule) => ({
      id: rule.id,
      hasAttributeConditions: (rule.pricing_rule_attributes ?? []).length > 0,
      fieldConditions: (rule.pricing_rule_field_conditions ?? []).map((condition) => ({
        serviceFieldId: condition.service_field_id,
        expectedValue: condition.expected_value as string | number | boolean | null,
      })),
    })),
    {
      requireCompleteCompatibility: technicalConfig.requireCompleteCompatibility === true,
      fallbackBehavior: candidate.fallbackBehavior === 'use_base' ? 'use_base' : 'block',
    },
  );
  coverage.inspectedCombinations = computedCoverage.inspectedCombinations;
  coverage.uncoveredCombinations = computedCoverage.uncoveredCombinations;
  coverage.ambiguousCombinations = computedCoverage.ambiguousCombinations;
  coverage.limited = computedCoverage.limited;

  if (coverage.ambiguousCombinations > 0) {
    errors.push(`${coverage.ambiguousCombinations} combinação(ões) de campos possuem mais de uma regra vencedora.`);
  }
  if (coverage.uncoveredCombinations > 0) {
    const message = `${coverage.uncoveredCombinations} combinação(ões) de campos não possuem regra específica.`;
    if (candidate.fallbackBehavior === 'block') warnings.push(`${message} A cotação será bloqueada com segurança.`);
    else warnings.push(`${message} Elas usarão o preço-base explicitamente configurado.`);
  }
  if (coverage.limited) {
    warnings.push('Há mais de 10.000 combinações possíveis; a cobertura integral precisa ser simplificada antes da publicação automática.');
  }
  if (computedCoverage.unsupportedRuleFieldIds.length > 0) {
    errors.push('Há regra de preço condicionada a um campo livre (texto ou número), cuja cobertura não pode ser comprovada.');
  }
  if (computedCoverage.rulesWithLegacyAttributes > 0) {
    errors.push('Há regras ativas usando atributos legados fora dos campos do serviço. Migre-as para campos do catálogo antes de publicar.');
  }

  if (candidate.state === 'published') {
    const isManualQuote = candidate.pricingProfile === 'manual_quote';
    const isBindingByFile = candidate.pricingProfile === 'binding_by_file_pages';
    const isPrintRun = candidate.pricingProfile === 'per_print_run';
    if (isBindingByFile && (bindingTiersResult.data?.length ?? 0) === 0) {
      errors.push('A encadernação por arquivo exige ao menos uma faixa de preço ativa.');
    }
    if (!isManualQuote && !isBindingByFile && candidate.fallbackBehavior === 'block' && activeRules.length === 0) {
      errors.push('A publicação exige uma regra ativa quando o fallback bloqueia a cotação.');
    }
    if (!isManualQuote && !isBindingByFile && candidate.fallbackBehavior === 'use_base' && candidate.basePriceCents === 0 && activeRules.length === 0) {
      errors.push('A publicação exige preço-base maior que zero ou uma regra de preço ativa.');
    }
    if (isPrintRun) {
      if (candidate.fallbackBehavior !== 'block') errors.push('Produtos por tiragem devem bloquear a cotação quando não houver regra específica.');
      if (!technicalConfig.runFieldKey || !technicalConfig.productionLeadTimeBusinessDays) {
        errors.push('Produtos por tiragem exigem campo de tiragem e prazo de produção configurados.');
      }
      const runField = (fieldsResult.data ?? []).find((field) => field.is_active && field.key === technicalConfig.runFieldKey);
      if (!runField || (runField.field_type !== 'select' && runField.field_type !== 'radio')) {
        errors.push('O campo de tiragem precisa existir, estar ativo e ser de seleção única.');
      }
      if (coverage.uncoveredCombinations > 0 || coverage.limited) {
        errors.push('Produtos por tiragem exigem cobertura inequívoca de todas as combinações antes da publicação.');
      }
    }
    if (!isManualQuote && !isBindingByFile && candidate.fallbackBehavior === 'block'
        && coverage.uncoveredCombinations > 0) {
      errors.push('A publicação com cotação automática bloqueada exige uma regra vencedora para cada combinação permitida.');
    }
    if (!isManualQuote && !isBindingByFile && coverage.limited) {
      errors.push('A publicação automática exige cobertura integral; reduza a matriz ou configure orçamento manual.');
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
