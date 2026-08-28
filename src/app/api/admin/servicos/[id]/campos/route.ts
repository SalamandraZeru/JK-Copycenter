import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { logAdminAction } from '@/lib/auth/admin';
import type { Json } from '@/types/supabase';
import type { TablesUpdate } from '@/types';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';
import { multiplierToBps, reaisToCents } from '@/lib/pricing/money';
import { getCatalogEditability } from '@/lib/catalog/editorial';

export const dynamic = 'force-dynamic';

const optionSchema = z.object({
  value: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(200),
  is_active: z.boolean().optional(),
  price_effect: z.object({
    type: z.enum(['fixed', 'multiply', 'per_page', 'none']),
    value: z.number().finite().min(0).max(1_000_000),
  }).optional(),
}).strict();
const serviceFieldSchema = z.object({
  key: z.string().trim().min(1).max(100).regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  label: z.string().trim().min(1).max(200),
  field_type: z.enum(['select', 'radio', 'number', 'text', 'textarea', 'checkbox']),
  options: z.array(optionSchema).max(100).optional(),
  is_required: z.boolean().optional(),
  sort_order: z.coerce.number().int().min(-100_000).max(100_000).optional(),
  is_active: z.boolean().optional(),
});
const createServiceFieldSchema = serviceFieldSchema.strict();
const updateServiceFieldSchema = serviceFieldSchema.partial().extend({ id: z.string().uuid() }).strict();

function normalizedOptions(options: z.infer<typeof optionSchema>[]): Json {
  const normalized = options.map((option) => {
    const effect = option.price_effect;
    const priceEffect = !effect || effect.type === 'none'
      ? { type: 'none' as const }
      : effect.type === 'multiply'
        ? { type: 'multiply' as const, multiplier_bps: multiplierToBps(effect.value) }
        : { type: effect.type, value_cents: reaisToCents(effect.value) };
    return {
      value: option.value,
      label: option.label,
      is_active: option.is_active ?? true,
      price_effect: priceEffect,
    };
  });
  return JSON.parse(JSON.stringify(normalized)) as Json;
}

function serviceFieldErrorMessage(message: string): string {
  if (message.includes('SERVICE_CATALOG_PUBLISHED_EDIT_LOCKED')) {
    return 'O serviço está publicado. Mova-o para revisão antes de alterar campos, vínculos ou regras de preço.';
  }
  if (message.includes('SERVICE_FIELD_DEPENDENCY_FIELD_STILL_REFERENCED')) {
    return 'Este campo possui vínculos entre opções. Exclua os vínculos antes de desativá-lo.';
  }
  if (message.includes('SERVICE_FIELD_DEPENDENCY_OPTION_STILL_REFERENCED')) {
    return 'Uma opção removida ou inativada ainda é usada em vínculos. Exclua esses vínculos antes de salvar o campo.';
  }
  if (message.includes('SERVICE_FIELD_PRICING_OPTION_REMOVAL_BLOCKED')) {
    return 'Uma opção removida ainda é referenciada por regras ou histórico comercial. Mantenha-a inativa em vez de apagá-la.';
  }
  if (message.includes('SERVICE_FIELD_ACTIVE_PRICING_OPTION_STILL_REFERENCED')) {
    return 'Uma opção usada por regra ativa não pode ser inativada. Desative ou substitua a regra antes de salvar o campo.';
  }
  if (message.includes('SERVICE_FIELD_ACTIVE_PRICING_FIELD_STILL_REFERENCED')) {
    return 'Este campo ainda é usado por regra ativa. Desative ou substitua a regra antes de alterar sua estrutura.';
  }
  return message;
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireApiAdminPermission('manage_catalog');
    if (!auth.success) return auth.errorResponse;
    if (!isUuid(params.id)) return NextResponse.json({ error: 'ID do serviço inválido' }, { status: 400 });

    const supabase = createServiceRoleClient();
    
    // Buscar serviço
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', params.id)
      .single();

    if (serviceError) {
      return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 });
    }

    // Buscar campos dinâmicos deste serviço
    const { data: fields, error: fieldsError } = await supabase
      .from('service_fields')
      .select('*')
      .eq('service_id', params.id)
      .order('sort_order', { ascending: true });

    if (fieldsError) {
      return NextResponse.json({ ...service, fields: [] });
    }

    return NextResponse.json({ ...service, fields: fields || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar serviço';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireApiAdminPermission('manage_catalog');
    if (!auth.success) return auth.errorResponse;
    if (!isUuid(params.id)) return NextResponse.json({ error: 'ID do serviço inválido' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const editability = await getCatalogEditability(supabase, params.id);
    if (!editability.editable) return NextResponse.json({ error: editability.error }, { status: editability.status });
    const parsed = await parseAdminJson(request, createServiceFieldSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const { data, error } = await supabase
      .from('service_fields')
      .insert({
        service_id: params.id,
        key: body.key,
        label: body.label,
        field_type: body.field_type,
        options: normalizedOptions(body.options || []),
        is_required: body.is_required ?? true,
        sort_order: body.sort_order ?? 0,
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) throw error;

    await logAdminAction(supabase, auth.session.id, 'create_service_field', 'service_fields', data.id, {
      service_id: params.id,
      key: data.key,
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = serviceFieldErrorMessage(error instanceof Error ? error.message : 'Erro ao criar campo');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireApiAdminPermission('manage_catalog');
    if (!auth.success) return auth.errorResponse;
    if (!isUuid(params.id)) return NextResponse.json({ error: 'ID do serviço inválido' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const editability = await getCatalogEditability(supabase, params.id);
    if (!editability.editable) return NextResponse.json({ error: editability.error }, { status: editability.status });
    const parsed = await parseAdminJson(request, updateServiceFieldSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const updatePayload: TablesUpdate<'service_fields'> = {};
    if (body.key !== undefined) updatePayload.key = body.key;
    if (body.label !== undefined) updatePayload.label = body.label;
    if (body.field_type !== undefined) updatePayload.field_type = body.field_type;
    if (body.options !== undefined) updatePayload.options = normalizedOptions(body.options);
    if (body.is_required !== undefined) updatePayload.is_required = body.is_required;
    if (body.sort_order !== undefined) updatePayload.sort_order = body.sort_order;
    if (body.is_active !== undefined) updatePayload.is_active = body.is_active;

    const { data, error } = await supabase
      .from('service_fields')
      .update(updatePayload)
      .eq('id', body.id)
      .eq('service_id', params.id)
      .select()
      .single();

    if (error) throw error;

    await logAdminAction(supabase, auth.session.id, 'update_service_field', 'service_fields', data.id, {
      service_id: params.id,
      key: data.key,
    });

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = serviceFieldErrorMessage(error instanceof Error ? error.message : 'Erro ao atualizar campo');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireApiAdminPermission('manage_catalog');
    if (!auth.success) return auth.errorResponse;
    if (!isUuid(params.id)) return NextResponse.json({ error: 'ID do serviço inválido' }, { status: 400 });

    const supabase = createServiceRoleClient();
    const editability = await getCatalogEditability(supabase, params.id);
    if (!editability.editable) return NextResponse.json({ error: editability.error }, { status: editability.status });
    const { searchParams } = new URL(request.url);
    const fieldId = searchParams.get('fieldId');

    if (!isUuid(fieldId)) {
      return NextResponse.json({ error: 'ID do campo não informado' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('service_fields')
      .update({ is_active: false })
      .eq('id', fieldId)
      .eq('service_id', params.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Campo não encontrado' }, { status: 404 });

    await logAdminAction(supabase, auth.session.id, 'deactivate_service_field', 'service_fields', fieldId, {
      service_id: params.id,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = serviceFieldErrorMessage(error instanceof Error ? error.message : 'Erro ao excluir campo');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
