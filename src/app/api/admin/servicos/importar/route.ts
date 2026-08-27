import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { logAdminAction } from '@/lib/auth/admin';
import { parseAdminJson } from '@/lib/security/admin-input';
import type { Json } from '@/types/supabase';

const scalar = z.union([z.string().max(5_000), z.number().finite(), z.boolean()]).nullable();
const fieldKey = z.string().trim().min(1).max(100).regex(/^[A-Za-z][A-Za-z0-9_]*$/);
const importSchema = z.object({
  format: z.literal('jk-copycenter.service-config/v1'),
  service: z.object({
    name: z.string().trim().min(1).max(200),
    slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().max(5_000).nullable().optional(),
    image_url: z.string().trim().max(2_000_000).nullable().optional(),
    base_price_cents: z.number().int().min(0).max(100_000_000),
    pricing_fallback_behavior: z.enum(['use_base', 'block']),
    sort_order: z.number().int().min(-100_000).max(100_000).optional(),
  }).strict(),
  fields: z.array(z.object({
    key: fieldKey,
    label: z.string().trim().min(1).max(200),
    field_type: z.enum(['select', 'radio', 'number', 'text', 'textarea', 'checkbox']),
    options: z.array(z.unknown()).max(100).default([]),
    is_required: z.boolean().default(true),
    is_active: z.boolean().default(true),
    sort_order: z.number().int().min(-100_000).max(100_000).default(0),
  }).strict()).max(100),
  pricing_rules: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    price_per_page_cents: z.number().int().min(0).max(100_000_000),
    fallback_behavior: z.string().max(100).optional(),
    attributes: z.array(z.object({
      attribute_id: z.string().uuid().nullable(),
      attribute_group_id: z.string().uuid(),
    }).strict()).max(100).default([]),
    field_conditions: z.array(z.object({
      field_key: fieldKey,
      expected_value: scalar,
    }).strict()).max(100).default([]),
  }).strict()).max(500).default([]),
  binding_price_tiers: z.array(z.object({
    min_pages: z.number().int().min(1).max(1_000_000),
    max_pages: z.number().int().min(1).max(1_000_000).nullable(),
    price_cents: z.number().int().min(0).max(100_000_000),
  }).strict()).max(1_000).default([]),
  field_option_dependencies: z.array(z.object({
    source_field_key: fieldKey,
    source_option_value: z.string().trim().min(1).max(200),
    source_conditions: z.array(z.object({ field_key: fieldKey, option_value: z.string().trim().min(1).max(200) }).strict()).max(100).default([]),
    target_field_key: fieldKey,
    target_option_value: z.string().trim().min(1).max(200),
  }).strict()).max(10_000).default([]),
}).strict();

export async function POST(request: Request) {
  const auth = await requireApiAdminPermission('manage_catalog');
  if (!auth.success) return auth.errorResponse;
  const pricingAuth = await requireApiAdminPermission('manage_pricing');
  if (!pricingAuth.success) return pricingAuth.errorResponse;
  const parsed = await parseAdminJson(request, importSchema);
  if (!parsed.success) return parsed.errorResponse;

  const config = parsed.data;
  const pricingRules = config.pricing_rules ?? [];
  const bindingPriceTiers = config.binding_price_tiers ?? [];
  const fieldOptionDependencies = config.field_option_dependencies ?? [];
  if (new Set(config.fields.map((field) => field.key)).size !== config.fields.length) {
    return NextResponse.json({ error: 'As chaves dos campos importados precisam ser únicas.' }, { status: 422 });
  }
  if (bindingPriceTiers.some((tier) => tier.max_pages !== null && tier.max_pages < tier.min_pages)) {
    return NextResponse.json({ error: 'Uma faixa de encadernação possui limite máximo menor que o mínimo.' }, { status: 422 });
  }

  const supabase = createServiceRoleClient();
  const attributeIds = pricingRules.flatMap((rule) => (rule.attributes ?? []).flatMap((link) => link.attribute_id ? [link.attribute_id] : []));
  if (attributeIds.length > 0) {
    const { data: attributes, error } = await supabase.from('attributes').select('id').in('id', [...new Set(attributeIds)]);
    if (error || (attributes?.length ?? 0) !== new Set(attributeIds).size) {
      return NextResponse.json({ error: 'O arquivo cita atributos que não existem neste catálogo.' }, { status: 422 });
    }
  }

  try {
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .insert({
        name: config.service.name,
        slug: config.service.slug,
        description: config.service.description ?? null,
        image_url: config.service.image_url ?? null,
        category_id: null,
        base_price_cents: config.service.base_price_cents,
        pricing_fallback_behavior: config.service.pricing_fallback_behavior,
        sort_order: config.service.sort_order ?? 0,
        catalog_state: 'draft',
        is_active: false,
        catalog_updated_by: auth.session.id,
      })
      .select('id, name, slug')
      .single();
    if (serviceError) throw serviceError;

    const fieldIdByKey = new Map<string, string>();
    for (const field of config.fields) {
      const { data, error } = await supabase.from('service_fields').insert({
        service_id: service.id,
        key: field.key,
        label: field.label,
        field_type: field.field_type,
        options: JSON.parse(JSON.stringify(field.options)) as Json,
        is_required: field.is_required ?? true,
        is_active: field.is_active ?? true,
        sort_order: field.sort_order ?? 0,
      }).select('id').single();
      if (error) throw error;
      fieldIdByKey.set(field.key, data.id);
    }

    for (const rule of pricingRules) {
      const attributes = rule.attributes ?? [];
      const fieldConditions = rule.field_conditions ?? [];
      const { data, error } = await supabase.from('pricing_rules').insert({
        service_id: service.id,
        name: rule.name,
        price_per_page_cents: rule.price_per_page_cents,
        fallback_behavior: rule.fallback_behavior ?? 'block',
        is_active: false,
      }).select('id').single();
      if (error) throw error;
      if (attributes.length > 0) {
        const { error: linksError } = await supabase.from('pricing_rule_attributes').insert(attributes.map((link) => ({
          pricing_rule_id: data.id,
          attribute_id: link.attribute_id,
          attribute_group_id: link.attribute_group_id,
        })));
        if (linksError) throw linksError;
      }
      const conditions = fieldConditions.flatMap((condition) => {
        const service_field_id = fieldIdByKey.get(condition.field_key);
        return service_field_id ? [{ pricing_rule_id: data.id, service_field_id, expected_value: condition.expected_value }] : [];
      });
      if (conditions.length !== fieldConditions.length) throw new Error('O arquivo cita uma chave de campo inexistente.');
      if (conditions.length > 0) {
        const { error: conditionsError } = await supabase.from('pricing_rule_field_conditions').insert(conditions);
        if (conditionsError) throw conditionsError;
      }
    }

    if (bindingPriceTiers.length > 0) {
      const { error } = await supabase.from('service_binding_price_tiers').insert(bindingPriceTiers.map((tier) => ({
        service_id: service.id,
        min_pages: tier.min_pages,
        max_pages: tier.max_pages,
        price_cents: tier.price_cents,
        is_active: false,
      })));
      if (error) throw error;
    }

    const dependencies = fieldOptionDependencies.flatMap((dependency) => {
      const sourceConditions = dependency.source_conditions ?? [];
      const source_field_id = fieldIdByKey.get(dependency.source_field_key);
      const target_field_id = fieldIdByKey.get(dependency.target_field_key);
      const source_conditions = sourceConditions.flatMap((condition) => {
        const field_id = fieldIdByKey.get(condition.field_key);
        return field_id ? [{ field_id, option_value: condition.option_value }] : [];
      });
      return source_field_id && target_field_id && source_conditions.length === sourceConditions.length ? [{
        service_id: service.id,
        source_field_id,
        source_option_value: dependency.source_option_value,
        source_conditions,
        target_field_id,
        target_option_value: dependency.target_option_value,
      }] : [];
    });
    if (dependencies.length !== fieldOptionDependencies.length) {
      throw new Error('O arquivo cita uma dependência entre campos inexistentes.');
    }
    if (dependencies.length > 0) {
      const { error } = await supabase.from('service_field_option_dependencies').insert(dependencies);
      if (error) throw error;
    }

    await logAdminAction(supabase, auth.session.id, 'import_service_config', 'services', service.id, {
      format: config.format,
      imported_as_draft: true,
    });
    return NextResponse.json({ ...service, catalog_state: 'draft' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível importar o serviço.' }, { status: 500 });
  }
}
