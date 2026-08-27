import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import type { Json } from '@/types/supabase';
import type { ServiceFieldOption, ServiceWithFields } from '@/types/service';
import { isPricingProfile, normalizePricingProfileConfig } from '@/lib/pricing/profiles';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function publicOptions(value: Json): ServiceFieldOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    if (typeof raw.value !== 'string' || typeof raw.label !== 'string' || raw.is_active === false) return [];
    return [{ value: raw.value, label: raw.label }];
  });
}

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const params = await props.params;
  if (!UUID_PATTERN.test(params.id)) {
    return NextResponse.json({ success: false, error: 'Identificador inválido.' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: service, error } = await supabase
    .from('services')
    .select('id, name, slug, description, image_url, base_price, pricing_profile, pricing_profile_config, service_fields(id, service_id, key, label, field_type, options, is_required, sort_order, is_active)')
    .eq('id', params.id)
    .eq('is_active', true)
    .eq('catalog_state', 'published')
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !service) {
    return NextResponse.json({ success: false, error: 'Serviço não encontrado.' }, { status: 404 });
  }
  if (!isPricingProfile(service.pricing_profile)) {
    return NextResponse.json({ success: false, error: 'Perfil de cobrança do serviço inválido.' }, { status: 503 });
  }

  const [bindingResult, dependenciesResult] = await Promise.all([
    supabase
      .from('service_binding_price_tiers')
      .select('id')
      .eq('service_id', service.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('service_field_option_dependencies')
      .select('source_field_id, source_option_value, source_conditions, target_field_id, target_option_value')
      .eq('service_id', service.id),
  ]);
  if (bindingResult.error || dependenciesResult.error) {
    return NextResponse.json({ success: false, error: 'Não foi possível carregar os acabamentos do serviço.' }, { status: 500 });
  }

  const result: ServiceWithFields = {
    id: service.id,
    name: service.name,
    slug: service.slug,
    description: service.description,
    imageUrl: service.image_url,
    basePrice: service.base_price,
    pricingProfile: service.pricing_profile,
    pricingProfileConfig: normalizePricingProfileConfig(service.pricing_profile_config),
    bindingAvailable: Boolean(bindingResult.data),
    fields: (service.service_fields ?? [])
      .filter((field) => field.is_active)
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((field) => ({
        id: field.id,
        serviceId: field.service_id,
        key: field.key,
        label: field.label,
        fieldType: field.field_type,
        options: publicOptions(field.options),
        isRequired: field.is_required,
        sortOrder: field.sort_order,
      })),
    fieldOptionDependencies: (dependenciesResult.data ?? []).map((dependency) => ({
      sourceFieldId: dependency.source_field_id,
      sourceOptionValue: dependency.source_option_value,
      sourceConditions: Array.isArray(dependency.source_conditions)
        ? dependency.source_conditions.flatMap((condition) => {
          if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return [];
          const fieldId = condition.field_id;
          const optionValue = condition.option_value;
          return typeof fieldId === 'string' && typeof optionValue === 'string'
            ? [{ fieldId, optionValue }]
            : [];
        })
        : [{ fieldId: dependency.source_field_id, optionValue: dependency.source_option_value }],
      targetFieldId: dependency.target_field_id,
      targetOptionValue: dependency.target_option_value,
    })),
  };
  return NextResponse.json({ success: true, data: result });
}
