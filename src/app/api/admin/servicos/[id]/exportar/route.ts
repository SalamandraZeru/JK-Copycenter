import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { isUuid } from '@/lib/security/admin-input';

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdminPermission('manage_catalog');
  if (!auth.success) return auth.errorResponse;
  const pricingAuth = await requireApiAdminPermission('manage_pricing');
  if (!pricingAuth.success) return pricingAuth.errorResponse;
  const { id } = await props.params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const [serviceResult, fieldsResult, rulesResult, tiersResult, dependenciesResult] = await Promise.all([
    supabase.from('services').select('name, slug, description, image_url, base_price_cents, pricing_fallback_behavior, sort_order').eq('id', id).is('deleted_at', null).maybeSingle(),
    supabase.from('service_fields').select('id, key, label, field_type, options, is_required, is_active, sort_order').eq('service_id', id).order('sort_order'),
    supabase.from('pricing_rules').select('id, name, price_per_page_cents, fallback_behavior, is_active').eq('service_id', id).order('created_at'),
    supabase.from('service_binding_price_tiers').select('min_pages, max_pages, price_cents, is_active').eq('service_id', id).order('min_pages'),
    supabase.from('service_field_option_dependencies').select('source_field_id, source_option_value, source_conditions, target_field_id, target_option_value').eq('service_id', id),
  ]);
  if (serviceResult.error || !serviceResult.data) return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });
  if (fieldsResult.error || rulesResult.error || tiersResult.error || dependenciesResult.error) {
    return NextResponse.json({ error: 'Não foi possível exportar a configuração.' }, { status: 500 });
  }

  const fields = fieldsResult.data ?? [];
  const fieldKeyById = new Map(fields.map((field) => [field.id, field.key]));
  const rules = rulesResult.data ?? [];
  const ruleIds = rules.map((rule) => rule.id);
  const [attributesResult, conditionsResult] = ruleIds.length === 0
    ? [{ data: [], error: null }, { data: [], error: null }]
    : await Promise.all([
      supabase.from('pricing_rule_attributes').select('pricing_rule_id, attribute_id, attribute_group_id').in('pricing_rule_id', ruleIds),
      supabase.from('pricing_rule_field_conditions').select('pricing_rule_id, service_field_id, expected_value').in('pricing_rule_id', ruleIds),
    ]);
  if (attributesResult.error || conditionsResult.error) {
    return NextResponse.json({ error: 'Não foi possível exportar as regras de preço.' }, { status: 500 });
  }

  return NextResponse.json({
    format: 'jk-copycenter.service-config/v1',
    exported_at: new Date().toISOString(),
    service: serviceResult.data,
    fields: fields.map(({ id: _id, ...field }) => field),
    pricing_rules: rules.map((rule) => ({
      name: rule.name,
      price_per_page_cents: rule.price_per_page_cents,
      fallback_behavior: rule.fallback_behavior,
      is_active: rule.is_active,
      attributes: (attributesResult.data ?? [])
        .filter((attribute) => attribute.pricing_rule_id === rule.id)
        .map(({ pricing_rule_id: _ruleId, ...attribute }) => attribute),
      field_conditions: (conditionsResult.data ?? []).flatMap((condition) => {
        const field_key = fieldKeyById.get(condition.service_field_id);
        return field_key ? [{ field_key, expected_value: condition.expected_value }] : [];
      }),
    })),
    binding_price_tiers: tiersResult.data ?? [],
    field_option_dependencies: (dependenciesResult.data ?? []).flatMap((dependency) => {
      const source_field_key = fieldKeyById.get(dependency.source_field_id);
      const target_field_key = fieldKeyById.get(dependency.target_field_id);
      const source_conditions = Array.isArray(dependency.source_conditions)
        ? dependency.source_conditions.flatMap((condition) => {
          if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return [];
          const record = condition as Record<string, unknown>;
          const field_key = typeof record.field_id === 'string' ? fieldKeyById.get(record.field_id) : undefined;
          return field_key && typeof record.option_value === 'string'
            ? [{ field_key, option_value: record.option_value }]
            : [];
        })
        : [];
      return source_field_key && target_field_key ? [{
        source_field_key,
        source_option_value: dependency.source_option_value,
        source_conditions,
        target_field_key,
        target_option_value: dependency.target_option_value,
      }] : [];
    }),
  }, {
    headers: {
      'Content-Disposition': `attachment; filename="servico-${id}-config.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
