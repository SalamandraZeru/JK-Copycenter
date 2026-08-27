import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { inspectServicePublication, type CatalogState } from '@/lib/catalog/publication';
import { isUuid } from '@/lib/security/admin-input';
import type { PricingProfile } from '@/types/pricing';

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdminPermission('manage_catalog');
  if (!auth.success) return auth.errorResponse;

  const { id } = await props.params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data: service, error } = await supabase
    .from('services')
    .select('id, name, slug, base_price_cents, pricing_fallback_behavior, pricing_profile, pricing_profile_config, catalog_state')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Não foi possível carregar o serviço.' }, { status: 500 });
  if (!service) return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });

  const readiness = await inspectServicePublication(supabase, service.id, {
    name: service.name,
    slug: service.slug,
    basePriceCents: service.base_price_cents,
    fallbackBehavior: service.pricing_fallback_behavior,
    pricingProfile: service.pricing_profile as PricingProfile,
    pricingProfileConfig: service.pricing_profile_config,
    state: service.catalog_state as CatalogState,
  });
  return NextResponse.json(readiness);
}
