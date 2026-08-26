import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { ServiceConfigurator } from '@/components/servico/ServiceConfigurator';
import type { ServiceFieldOption, ServiceWithFields } from '@/types/service';
import type { Json } from '@/types/supabase';

const SERVICE_ALIASES: Record<string, string> = { 'impressao-pb': 'impressao' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function publicOptions(value: Json): ServiceFieldOption[] {
  if (!Array.isArray(value)) return [];
  const result: ServiceFieldOption[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    if (typeof raw.value !== 'string' || typeof raw.label !== 'string' || raw.is_active === false) continue;
    result.push({ value: raw.value, label: raw.label });
  }
  return result;
}

async function loadService(idOrSlug: string): Promise<ServiceWithFields | null> {
  if (!UUID_PATTERN.test(idOrSlug) && !SLUG_PATTERN.test(idOrSlug)) return null;
  const supabase = createServiceRoleClient();
  let query = supabase
    .from('services')
    .select('id, name, slug, description, image_url, base_price, service_fields(id, service_id, key, label, field_type, options, is_required, sort_order, is_active)')
    .eq('is_active', true)
    .is('deleted_at', null);
  query = UUID_PATTERN.test(idOrSlug) ? query.eq('id', idOrSlug) : query.eq('slug', idOrSlug);
  const { data: service, error } = await query.maybeSingle();
  if (error || !service) return null;

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
  if (bindingResult.error || dependenciesResult.error) return null;

  return {
    id: service.id,
    name: service.name,
    slug: service.slug,
    description: service.description,
    imageUrl: service.image_url,
    basePrice: service.base_price,
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
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const canonicalId = SERVICE_ALIASES[params.id] ?? params.id;
  const service = await loadService(canonicalId);
  return {
    title: `${service?.name ?? 'Serviço indisponível'} | JK Copycenter`,
    description: service?.description ?? 'Consulte os serviços disponíveis no catálogo.',
  };
}

export default async function ServicoPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (params.id in SERVICE_ALIASES) redirect(`/servico/${SERVICE_ALIASES[params.id]}`);
  const service = await loadService(params.id);
  if (!service) notFound();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <nav className="flex mb-8 text-sm text-slate-500">
        <Link href="/" className="hover:text-blue-600 transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/grafica" className="hover:text-blue-600 transition-colors">Gráfica</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-900 font-medium">{service.name}</span>
      </nav>
      <ServiceConfigurator service={service} />
    </div>
  );
}
