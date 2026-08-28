import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { isUuid } from '@/lib/security/admin-input';

export const dynamic = 'force-dynamic';

/**
 * Read-only catalog projection for the pricing editor. It deliberately uses
 * manage_pricing instead of the broader manage_catalog permission.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireApiAdminPermission('manage_pricing');
  if (!auth.success) return auth.errorResponse;

  const serviceId = new URL(request.url).searchParams.get('service_id');
  if (!isUuid(serviceId)) return NextResponse.json({ error: 'Serviço inválido.' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data: service, error: serviceError } = await supabase
    .from('services')
    .select('id, name, catalog_state')
    .eq('id', serviceId)
    .is('deleted_at', null)
    .maybeSingle();
  if (serviceError) return NextResponse.json({ error: serviceError.message }, { status: 500 });
  if (!service || service.catalog_state === 'inactive') return NextResponse.json({ error: 'Serviço inexistente ou inativo.' }, { status: 404 });

  const { data: fields, error: fieldsError } = await supabase
    .from('service_fields')
    .select('id, key, label, field_type, options, is_required, sort_order')
    .eq('service_id', service.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (fieldsError) return NextResponse.json({ error: fieldsError.message }, { status: 500 });

  return NextResponse.json({ service, fields: fields ?? [] });
}
