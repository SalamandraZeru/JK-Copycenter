import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/supabase';
import type {
  FallbackBehavior,
  PricingContext,
  PricingDiscount,
  PricingRoundingMode,
  PricingRule,
  PricingRuleAttribute,
  PricingRuleFieldCondition,
  ServerFieldPriceEffect,
  ServerPricingField,
  ServerPricingOption,
} from '@/types/pricing';

export class QuoteUnavailableError extends Error {
  readonly code = 'QUOTE_UNAVAILABLE';
}

function asRecord(value: Json | undefined): Record<string, Json | undefined> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function numericValue(value: Json | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function scalarFieldValue(value: Json | null): string | number | boolean | null {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new QuoteUnavailableError('Condição de campo de preço inválida.');
}

function normalizePriceEffect(value: Json | undefined): ServerFieldPriceEffect {
  const effect = asRecord(value);
  if (!effect) return { type: 'none' };

  const type = typeof effect.type === 'string' ? effect.type : null;
  const valueCents = numericValue(effect.value_cents);
  const multiplierBps = numericValue(effect.multiplier_bps);
  if ((type === 'fixed' || type === 'per_page') && Number.isSafeInteger(valueCents) && valueCents! >= 0) {
    return { type, valueCents: valueCents! };
  }
  if (type === 'multiply' && Number.isSafeInteger(multiplierBps) && multiplierBps! > 0) {
    return { type: 'multiply', multiplierBps: multiplierBps! };
  }
  if (type === 'none') return { type: 'none' };

  const legacyMultiplier = numericValue(effect.multiplier);
  if (legacyMultiplier !== null && legacyMultiplier > 0) {
    return { type: 'multiply', multiplierBps: Math.round(legacyMultiplier * 10_000) };
  }
  const legacyAddedPrice = numericValue(effect.addedPrice) ?? numericValue(effect.value);
  if (legacyAddedPrice !== null && legacyAddedPrice >= 0) {
    return { type: 'fixed', valueCents: Math.round(legacyAddedPrice * 100) };
  }
  return { type: 'none' };
}

function normalizeOptions(value: Json): ServerPricingOption[] {
  if (!Array.isArray(value)) return [];
  const options: ServerPricingOption[] = [];
  for (const rawOption of value) {
    const option = asRecord(rawOption);
    if (!option || typeof option.value !== 'string' || typeof option.label !== 'string') continue;
    options.push({
      value: option.value,
      label: option.label,
      isActive: option.is_active !== false,
      priceEffect: normalizePriceEffect(option.price_effect),
    });
  }
  return options;
}

function requireIntegerSetting(settings: Map<string, Json>, key: string): number {
  const value = numericValue(settings.get(key));
  if (value === null || !Number.isSafeInteger(value)) {
    throw new QuoteUnavailableError(`Configuração obrigatória ausente: ${key}`);
  }
  return value;
}

export async function loadPricingData(
  supabase: SupabaseClient<Database>,
  serviceId: string
): Promise<PricingContext> {
  const { data: service, error: serviceError } = await supabase
    .from('services')
    .select('id, name, description, base_price_cents, pricing_fallback_behavior, pricing_version')
    .eq('id', serviceId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (serviceError || !service) {
    throw new QuoteUnavailableError('Serviço inexistente ou inativo.');
  }

  const [fieldsResult, attributesResult, rulesResult, discountsResult, settingsResult] = await Promise.all([
    supabase
      .from('service_fields')
      .select('id, key, label, field_type, options, is_required, is_active')
      .eq('service_id', service.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('attributes')
      .select('id, group_id, is_active'),
    supabase
      .from('pricing_rules')
      .select(`
        id,
        service_id,
        name,
        price_per_page_cents,
        rule_version,
        is_active,
        pricing_rule_attributes (
          attribute_id,
          attribute_group_id
        ),
        pricing_rule_field_conditions (
          service_field_id,
          expected_value
        )
      `)
      .eq('service_id', service.id)
      .eq('is_active', true),
    supabase
      .from('pricing_discounts')
      .select('id, min_quantity, max_quantity, discount_percent')
      .eq('service_id', service.id)
      .eq('is_active', true),
    supabase
      .from('store_settings')
      .select('key, value')
      .in('key', ['double_sided_multiplier_bps', 'pricing_rounding_mode']),
  ]);

  const firstError = fieldsResult.error
    ?? attributesResult.error
    ?? rulesResult.error
    ?? discountsResult.error
    ?? settingsResult.error;
  if (firstError) throw new QuoteUnavailableError(`Falha ao carregar catálogo: ${firstError.message}`);

  const fields: ServerPricingField[] = (fieldsResult.data ?? []).map((field) => ({
    id: field.id,
    key: field.key,
    label: field.label,
    fieldType: field.field_type,
    isRequired: field.is_required,
    isActive: field.is_active,
    options: normalizeOptions(field.options),
  }));

  const rules: PricingRule[] = (rulesResult.data ?? []).map((rule) => {
    const links = Array.isArray(rule.pricing_rule_attributes)
      ? rule.pricing_rule_attributes
      : [];
    const attributes: PricingRuleAttribute[] = links.map((link) => ({
      attributeId: link.attribute_id,
      groupId: link.attribute_group_id,
    }));
    const fieldLinks = Array.isArray(rule.pricing_rule_field_conditions)
      ? rule.pricing_rule_field_conditions
      : [];
    const fieldConditions: PricingRuleFieldCondition[] = fieldLinks.map((link) => ({
      fieldId: link.service_field_id,
      expectedValue: scalarFieldValue(link.expected_value),
    }));
    return {
      id: rule.id,
      serviceId: rule.service_id,
      name: rule.name,
      pricePerPageCents: rule.price_per_page_cents,
      version: rule.rule_version,
      isActive: rule.is_active,
      attributes,
      fieldConditions,
    };
  });

  const discounts: PricingDiscount[] = (discountsResult.data ?? []).map((discount) => ({
    id: discount.id,
    minQuantity: discount.min_quantity,
    maxQuantity: discount.max_quantity,
    discountBps: Math.round(Number(discount.discount_percent) * 100),
  }));

  const settings = new Map((settingsResult.data ?? []).map((setting) => [setting.key, setting.value]));
  const doubleSidedMultiplierBps = requireIntegerSetting(settings, 'double_sided_multiplier_bps');
  const roundingValue = settings.get('pricing_rounding_mode');
  if (roundingValue !== 'half_up' && roundingValue !== 'floor' && roundingValue !== 'ceil') {
    throw new QuoteUnavailableError('Configuração obrigatória ausente: pricing_rounding_mode');
  }

  return {
    service: {
      id: service.id,
      name: service.name,
      description: service.description,
      basePriceCents: service.base_price_cents,
      fallbackBehavior: service.pricing_fallback_behavior as FallbackBehavior,
      pricingVersion: service.pricing_version,
    },
    attributes: (attributesResult.data ?? []).map((attribute) => ({
      id: attribute.id,
      groupId: attribute.group_id,
      isActive: attribute.is_active,
    })),
    fields,
    rules,
    discounts,
    doubleSidedMultiplierBps,
    roundingMode: roundingValue as PricingRoundingMode,
  };
}
