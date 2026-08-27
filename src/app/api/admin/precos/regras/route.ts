import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { logAdminAction } from '@/lib/auth/admin';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';
import { reaisToCents } from '@/lib/pricing/money';
import type { Json } from '@/types/supabase';

export const dynamic = 'force-dynamic';

const pricingRuleSchema = z.object({
  service_id: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  price_per_page: z.coerce.number().min(0).max(1_000_000),
  fallback_behavior: z.enum(['use_base', 'base_price', 'block']).optional(),
  is_active: z.boolean().optional(),
  attribute_ids: z.array(z.string().uuid()).max(100).default([]),
  wildcard_group_ids: z.array(z.string().uuid()).max(100).default([]),
  field_conditions: z.array(z.object({
    service_field_id: z.string().uuid(),
    expected_value: z.union([
      z.string().max(5_000),
      z.number().finite(),
      z.boolean(),
    ]).nullable(),
  }).strict()).max(100).default([]),
}).strict();

type ScalarFieldValue = string | number | boolean | null;

function pricingRuleErrorMessage(message: string): string {
  if (message.includes('PRICING_RULE_FIELD_SERVICE_MISMATCH')) {
    return 'Os campos deste serviço foram alterados. Atualize a página e monte a regra novamente com as opções atuais.';
  }
  if (message.includes('AMBIGUOUS_PRICING_RULE')) {
    return 'Já existe uma regra ativa com a mesma especificidade para esta combinação. Ajuste as condições ou exclua a regra conflitante.';
  }
  return message;
}

function optionValues(options: Json): Set<string> {
  if (!Array.isArray(options)) return new Set();
  return new Set(options.flatMap((option) => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) return [];
    const record = option as Record<string, Json | undefined>;
    return typeof record.value === 'string' && record.is_active !== false ? [record.value] : [];
  }));
}

function isValidFieldValue(
  field: { field_type: string; options: Json },
  value: ScalarFieldValue
): boolean {
  if (value === null) return true;
  if (field.field_type === 'select' || field.field_type === 'radio') {
    return typeof value === 'string' && optionValues(field.options).has(value);
  }
  if (field.field_type === 'checkbox') return typeof value === 'boolean';
  if (field.field_type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === 'string' && value.length <= 5_000;
}

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireApiAdminPermission('manage_pricing');
  if (!auth.success) return auth.errorResponse;

  const serviceId = new URL(request.url).searchParams.get('service_id');
  if (serviceId && !isUuid(serviceId)) return NextResponse.json({ error: 'Serviço inválido.' }, { status: 400 });
  const supabase = createServiceRoleClient();
  let query = supabase
    .from('pricing_rules')
    .select(`
      *,
      services (id, name),
      pricing_rule_attributes (
        id,
        attribute_id,
        attribute_group_id,
        attributes (id, name, group_id, attribute_groups (name))
      ),
      pricing_rule_field_conditions (
        id,
        service_field_id,
        expected_value,
        service_fields (id, key, label, field_type)
      )
    `)
    .order('created_at', { ascending: false });
  if (serviceId) query = query.eq('service_id', serviceId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireApiAdminPermission('manage_pricing');
  if (!auth.success) return auth.errorResponse;
  const parsed = await parseAdminJson(request, pricingRuleSchema);
  if (!parsed.success) return parsed.errorResponse;

  const body = parsed.data;
  const supabase = createServiceRoleClient();
  let createdRuleId: string | null = null;
  try {
    const { data: service } = await supabase
      .from('services')
      .select('id')
      .eq('id', body.service_id)
      .neq('catalog_state', 'inactive')
      .is('deleted_at', null)
      .maybeSingle();
    if (!service) return NextResponse.json({ error: 'Serviço inexistente, excluído ou inativo.' }, { status: 409 });

    const attributeIds = body.attribute_ids ?? [];
    const wildcardGroupIds = body.wildcard_group_ids ?? [];
    const uniqueAttributeIds = Array.from(new Set(attributeIds));
    const uniqueWildcardGroups = Array.from(new Set(wildcardGroupIds));
    const fieldConditions = body.field_conditions ?? [];
    const uniqueFieldIds = new Set(fieldConditions.map((condition) => condition.service_field_id));
    if (uniqueAttributeIds.length !== attributeIds.length
        || uniqueWildcardGroups.length !== wildcardGroupIds.length
        || uniqueFieldIds.size !== fieldConditions.length) {
      return NextResponse.json({ error: 'Atributos, grupos ou campos duplicados.' }, { status: 400 });
    }

    const { data: attributes, error: attributesError } = uniqueAttributeIds.length > 0
      ? await supabase.from('attributes').select('id, group_id, is_active').in('id', uniqueAttributeIds)
      : { data: [], error: null };
    if (attributesError || !attributes || attributes.length !== uniqueAttributeIds.length
        || attributes.some((attribute) => !attribute.is_active)) {
      return NextResponse.json({ error: 'Atributo inexistente ou inativo.' }, { status: 409 });
    }

    const groups = [...attributes.map((attribute) => attribute.group_id), ...uniqueWildcardGroups];
    if (new Set(groups).size !== groups.length) {
      return NextResponse.json({ error: 'Cada grupo pode aparecer apenas uma vez na regra.' }, { status: 409 });
    }
    if (uniqueWildcardGroups.length > 0) {
      const { data: wildcardGroups } = await supabase
        .from('attribute_groups')
        .select('id, is_active')
        .in('id', uniqueWildcardGroups);
      if (!wildcardGroups || wildcardGroups.length !== uniqueWildcardGroups.length
          || wildcardGroups.some((group) => !group.is_active)) {
        return NextResponse.json({ error: 'Grupo coringa inexistente ou inativo.' }, { status: 409 });
      }
    }

    const fieldIds = [...uniqueFieldIds];
    const { data: fields, error: fieldsError } = fieldIds.length > 0
      ? await supabase
        .from('service_fields')
        .select('id, service_id, field_type, options, is_active')
        .in('id', fieldIds)
      : { data: [], error: null };
    if (fieldsError || !fields || fields.length !== fieldIds.length
        || fields.some((field) => field.service_id !== body.service_id || !field.is_active)) {
      return NextResponse.json({ error: 'Campo inexistente, inativo ou de outro serviço.' }, { status: 409 });
    }
    const fieldsById = new Map(fields.map((field) => [field.id, field]));
    if (fieldConditions.some((condition) => {
      const field = fieldsById.get(condition.service_field_id);
      return !field || !isValidFieldValue(field, condition.expected_value);
    })) {
      return NextResponse.json({ error: 'Uma condição não corresponde às opções ativas do campo do serviço.' }, { status: 409 });
    }

    const { data: rule, error: ruleError } = await supabase
      .from('pricing_rules')
      .insert({
        service_id: body.service_id,
        name: body.name,
        price_per_page_cents: reaisToCents(body.price_per_page),
        fallback_behavior: 'block',
        is_active: false,
      })
      .select()
      .single();
    if (ruleError) throw ruleError;
    createdRuleId = rule.id;

    const links = [
      ...attributes.map((attribute) => ({
        pricing_rule_id: rule.id,
        attribute_id: attribute.id,
        attribute_group_id: attribute.group_id,
      })),
      ...uniqueWildcardGroups.map((groupId) => ({
        pricing_rule_id: rule.id,
        attribute_id: null,
        attribute_group_id: groupId,
      })),
    ];
    if (links.length > 0) {
      const { error: linksError } = await supabase.from('pricing_rule_attributes').insert(links);
      if (linksError) throw linksError;
    }

    if (fieldConditions.length > 0) {
      const { error: fieldConditionsError } = await supabase
        .from('pricing_rule_field_conditions')
        .insert(fieldConditions.map((condition) => ({
          pricing_rule_id: rule.id,
          service_field_id: condition.service_field_id,
          expected_value: condition.expected_value,
        })));
      if (fieldConditionsError) throw fieldConditionsError;
    }

    const shouldActivate = body.is_active ?? true;
    const { data: activated, error: activationError } = await supabase
      .from('pricing_rules')
      .update({ is_active: shouldActivate })
      .eq('id', rule.id)
      .select()
      .single();
    if (activationError) throw activationError;

    if (body.fallback_behavior) {
      const { error: fallbackError } = await supabase
        .from('services')
        .update({ pricing_fallback_behavior: body.fallback_behavior === 'block' ? 'block' : 'use_base' })
        .eq('id', body.service_id);
      if (fallbackError) throw fallbackError;
    }

    await logAdminAction(supabase, auth.session.id, 'create_pricing_rule', 'pricing_rules', rule.id, {
      name: rule.name,
      service_id: rule.service_id,
      price_per_page_cents: rule.price_per_page_cents,
      field_conditions: fieldConditions,
      active: shouldActivate,
    });
    return NextResponse.json(activated, { status: 201 });
  } catch (caught: unknown) {
    if (createdRuleId) await supabase.from('pricing_rules').delete().eq('id', createdRuleId);
    const rawMessage = caught instanceof Error ? caught.message : 'Erro ao criar regra de preço';
    const message = pricingRuleErrorMessage(rawMessage);
    const status = rawMessage.includes('AMBIGUOUS_PRICING_RULE') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const auth = await requireApiAdminPermission('manage_pricing');
  if (!auth.success) return auth.errorResponse;
  const id = new URL(request.url).searchParams.get('id');
  if (!isUuid(id)) return NextResponse.json({ error: 'ID não informado' }, { status: 400 });

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('pricing_rules')
      .delete()
      .eq('id', id)
      .select('id, name, service_id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 });
    await logAdminAction(supabase, auth.session.id, 'delete_pricing_rule', 'pricing_rules', id, {
      name: data.name,
      service_id: data.service_id,
      permanent: true,
    });
    return NextResponse.json({ success: true });
  } catch (caught: unknown) {
    return NextResponse.json({
      error: caught instanceof Error ? caught.message : 'Erro ao excluir regra',
    }, { status: 500 });
  }
}
