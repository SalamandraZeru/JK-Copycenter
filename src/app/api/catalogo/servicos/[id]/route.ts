import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import type { Json } from '@/types/supabase';
import type { ServiceFieldOption, ServiceWithFields } from '@/types/service';

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
    .select('id, name, slug, description, image_url, base_price, service_fields(id, service_id, key, label, field_type, options, is_required, sort_order, is_active)')
    .eq('id', params.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !service) {
    return NextResponse.json({ success: false, error: 'Serviço não encontrado.' }, { status: 404 });
  }

  const result: ServiceWithFields = {
    id: service.id,
    name: service.name,
    slug: service.slug,
    description: service.description,
    imageUrl: service.image_url,
    basePrice: service.base_price,
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
  };
  return NextResponse.json({ success: true, data: result });
}
