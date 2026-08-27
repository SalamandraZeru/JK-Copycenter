import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { logAdminAction } from '@/lib/auth/admin';
import { isUuid } from '@/lib/security/admin-input';

function copySlug(slug: string): string {
  const suffix = `-copia-${Date.now().toString(36)}`;
  return `${slug.slice(0, Math.max(1, 200 - suffix.length))}${suffix}`;
}

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdminPermission('manage_catalog');
  if (!auth.success) return auth.errorResponse;
  const pricingAuth = await requireApiAdminPermission('manage_pricing');
  if (!pricingAuth.success) return pricingAuth.errorResponse;
  const { id } = await props.params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const [serviceResult, fieldsResult, rulesResult, tiersResult, dependenciesResult] = await Promise.all([
    supabase.from('services').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
    supabase.from('service_fields').select('*').eq('service_id', id).order('sort_order'),
    supabase.from('pricing_rules').select('*').eq('service_id', id).order('created_at'),
    supabase.from('service_binding_price_tiers').select('*').eq('service_id', id).order('min_pages'),
    supabase.from('service_field_option_dependencies').select('*').eq('service_id', id),
  ]);
  if (serviceResult.error || !serviceResult.data) return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });
  if (fieldsResult.error || rulesResult.error || tiersResult.error || dependenciesResult.error) {
    return NextResponse.json({ error: 'Não foi possível carregar a configuração para duplicação.' }, { status: 500 });
  }

  try {
    const source = serviceResult.data;
    const { data: duplicate, error: duplicateError } = await supabase
      .from('services')
      .insert({
        name: `${source.name} (cópia)`,
        slug: copySlug(source.slug),
        description: source.description,
        image_url: source.image_url,
        category_id: null,
        base_price_cents: source.base_price_cents,
        pricing_fallback_behavior: source.pricing_fallback_behavior,
        catalog_state: 'draft',
        is_active: false,
        sort_order: source.sort_order + 1,
        catalog_updated_by: auth.session.id,
      })
      .select()
      .single();
    if (duplicateError) throw duplicateError;

    const oldToNewField = new Map<string, string>();
    for (const field of fieldsResult.data ?? []) {
      const { data: copied, error: fieldError } = await supabase
        .from('service_fields')
        .insert({
          service_id: duplicate.id,
          key: field.key,
          label: field.label,
          field_type: field.field_type,
          options: field.options,
          is_required: field.is_required,
          sort_order: field.sort_order,
          is_active: field.is_active,
        })
        .select('id')
        .single();
      if (fieldError) throw fieldError;
      oldToNewField.set(field.id, copied.id);
    }

    const oldToNewRule = new Map<string, string>();
    for (const rule of rulesResult.data ?? []) {
      const { data: copied, error: ruleError } = await supabase
        .from('pricing_rules')
        .insert({
          service_id: duplicate.id,
          name: rule.name,
          price_per_page_cents: rule.price_per_page_cents,
          fallback_behavior: rule.fallback_behavior,
          // Todo preço copiado exige revisão antes de poder ir para o catálogo.
          is_active: false,
        })
        .select('id')
        .single();
      if (ruleError) throw ruleError;
      oldToNewRule.set(rule.id, copied.id);
    }

    if (oldToNewRule.size > 0) {
      const sourceRuleIds = [...oldToNewRule.keys()];
      const [attributesResult, conditionsResult] = await Promise.all([
        supabase.from('pricing_rule_attributes').select('pricing_rule_id, attribute_id, attribute_group_id').in('pricing_rule_id', sourceRuleIds),
        supabase.from('pricing_rule_field_conditions').select('pricing_rule_id, service_field_id, expected_value').in('pricing_rule_id', sourceRuleIds),
      ]);
      if (attributesResult.error || conditionsResult.error) throw attributesResult.error ?? conditionsResult.error;

      const attributeCopies = (attributesResult.data ?? []).flatMap((link) => {
        const pricingRuleId = oldToNewRule.get(link.pricing_rule_id);
        return pricingRuleId ? [{ ...link, pricing_rule_id: pricingRuleId }] : [];
      });
      if (attributeCopies.length > 0) {
        const { error } = await supabase.from('pricing_rule_attributes').insert(attributeCopies);
        if (error) throw error;
      }
      const conditionCopies = (conditionsResult.data ?? []).flatMap((condition) => {
        const pricingRuleId = oldToNewRule.get(condition.pricing_rule_id);
        const serviceFieldId = oldToNewField.get(condition.service_field_id);
        return pricingRuleId && serviceFieldId
          ? [{ pricing_rule_id: pricingRuleId, service_field_id: serviceFieldId, expected_value: condition.expected_value }]
          : [];
      });
      if (conditionCopies.length > 0) {
        const { error } = await supabase.from('pricing_rule_field_conditions').insert(conditionCopies);
        if (error) throw error;
      }
    }

    const dependencyCopies = (dependenciesResult.data ?? []).flatMap((dependency) => {
      const sourceFieldId = oldToNewField.get(dependency.source_field_id);
      const targetFieldId = oldToNewField.get(dependency.target_field_id);
      return sourceFieldId && targetFieldId ? [{
        service_id: duplicate.id,
        source_field_id: sourceFieldId,
        source_option_value: dependency.source_option_value,
        source_conditions: dependency.source_conditions,
        target_field_id: targetFieldId,
        target_option_value: dependency.target_option_value,
      }] : [];
    });
    if (dependencyCopies.length > 0) {
      const { error } = await supabase.from('service_field_option_dependencies').insert(dependencyCopies);
      if (error) throw error;
    }

    const tierCopies = (tiersResult.data ?? []).map((tier) => ({
      service_id: duplicate.id,
      min_pages: tier.min_pages,
      max_pages: tier.max_pages,
      price_cents: tier.price_cents,
      is_active: false,
    }));
    if (tierCopies.length > 0) {
      const { error } = await supabase.from('service_binding_price_tiers').insert(tierCopies);
      if (error) throw error;
    }

    await logAdminAction(supabase, auth.session.id, 'duplicate_service', 'services', duplicate.id, {
      source_service_id: source.id,
      source_catalog_version: source.catalog_version,
      copied_as_draft: true,
    });
    return NextResponse.json(duplicate, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Não foi possível duplicar o serviço.',
    }, { status: 500 });
  }
}
