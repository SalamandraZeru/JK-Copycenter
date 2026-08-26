import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { logAdminAction } from '@/lib/auth/admin';
import { isUuid, parseAdminJson } from '@/lib/security/admin-input';
import type { Json } from '@/types/supabase';

export const dynamic = 'force-dynamic';

const optionValueSchema = z.string().trim().min(1).max(200);
const conditionSchema = z.object({
  field_id: z.string().uuid(),
  option_value: optionValueSchema,
}).strict();

const dependencySchema = z.object({
  source_field_id: z.string().uuid().optional(),
  source_option_value: optionValueSchema.optional(),
  source_conditions: z.array(conditionSchema).min(1).max(24).optional(),
  target_field_id: z.string().uuid(),
  target_option_value: optionValueSchema,
}).strict().superRefine((value, context) => {
  const hasLegacySource = Boolean(value.source_field_id && value.source_option_value);
  if (!value.source_conditions && !hasLegacySource) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe ao menos uma condição de origem.' });
  }
  if ((value.source_field_id && !value.source_option_value)
      || (!value.source_field_id && value.source_option_value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'A origem legada está incompleta.' });
  }
});

const replaceTreeSchema = z.object({
  root: conditionSchema,
  rules: z.array(z.object({
    source_conditions: z.array(conditionSchema).min(1).max(24),
    target_field_id: z.string().uuid(),
    target_option_value: optionValueSchema,
  }).strict()).max(2_000),
}).strict();

function dependencyErrorMessage(message: string): string {
  if (message.includes('SERVICE_FIELD_COMPATIBILITY_ROOT_INVALID')) return 'O campo inicial precisa estar ativo e ser de seleção, rádio ou caixa de marcar.';
  if (message.includes('SERVICE_FIELD_COMPATIBILITY_ROOT_OPTION_INVALID')) return 'A opção inicial não está ativa neste campo.';
  if (message.includes('SERVICE_FIELD_COMPATIBILITY_CHECKBOX_VALUE_INVALID')) return 'Para uma caixa de marcar, escolha apenas “permitir” ou “não permitir”.';
  if (message.includes('SERVICE_FIELD_COMPATIBILITY_OPTION_FIELD_REQUIRED')) return 'Somente campos de seleção, rádio ou caixa de marcar podem ser vinculados.';
  if (message.includes('SERVICE_FIELD_COMPATIBILITY_SOURCE_OPTION_INVALID')) return 'Uma opção usada no caminho não está ativa.';
  if (message.includes('SERVICE_FIELD_COMPATIBILITY_TARGET_OPTION_INVALID')) return 'A opção que será liberada não está ativa.';
  if (message.includes('SERVICE_FIELD_COMPATIBILITY_TARGET_IN_CONDITIONS')) return 'Um campo não pode ser antecedente e destino do mesmo caminho.';
  if (message.includes('SERVICE_FIELD_COMPATIBILITY_CONDITION_DUPLICATE_FIELD')) return 'O mesmo campo não pode aparecer duas vezes no mesmo caminho.';
  if (message.includes('SERVICE_FIELD_COMPATIBILITY_SERVICE_MISMATCH')) return 'Todos os campos do caminho devem pertencer ao mesmo serviço.';
  if (message.includes('SERVICE_FIELD_COMPATIBILITY_TREE_INVALID')) return 'A árvore de compatibilidades enviada é inválida.';
  if (message.includes('service_field_option_dependencies_unique_path')) return 'Este caminho de compatibilidade já existe.';
  return message;
}

function sourceConditionsFor(body: z.infer<typeof dependencySchema>) {
  if (body.source_conditions) return body.source_conditions;
  return [{
    field_id: body.source_field_id!,
    option_value: body.source_option_value!,
  }];
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireApiAdminPermission('manage_catalog');
  if (!auth.success) return auth.errorResponse;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID do serviço inválido.' }, { status: 400 });

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('service_field_option_dependencies')
    .select('id, service_id, source_field_id, source_option_value, source_conditions, target_field_id, target_option_value, created_at')
    .eq('service_id', params.id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: dependencyErrorMessage(error.message) }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireApiAdminPermission('manage_catalog');
  if (!auth.success) return auth.errorResponse;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID do serviço inválido.' }, { status: 400 });

  const parsed = await parseAdminJson(request, dependencySchema);
  if (!parsed.success) return parsed.errorResponse;
  const sourceConditions = sourceConditionsFor(parsed.data);
  const firstCondition = sourceConditions[0]!;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('service_field_option_dependencies')
      .insert({
        service_id: params.id,
        source_field_id: firstCondition.field_id,
        source_option_value: firstCondition.option_value,
        source_conditions: JSON.parse(JSON.stringify(sourceConditions)) as Json,
        target_field_id: parsed.data.target_field_id,
        target_option_value: parsed.data.target_option_value,
      })
      .select()
      .single();
    if (error) throw error;

    await logAdminAction(supabase, auth.session.id, 'create_service_field_option_dependency', 'service_field_option_dependencies', data.id, {
      service_id: params.id,
      source_conditions: sourceConditions,
      target_field_id: parsed.data.target_field_id,
      target_option_value: parsed.data.target_option_value,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? dependencyErrorMessage(error.message) : 'Não foi possível salvar o vínculo.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireApiAdminPermission('manage_catalog');
  if (!auth.success) return auth.errorResponse;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID do serviço inválido.' }, { status: 400 });

  const parsed = await parseAdminJson(request, replaceTreeSchema);
  if (!parsed.success) return parsed.errorResponse;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc('replace_service_field_option_dependencies', {
      p_service_id: params.id,
      p_root_field_id: parsed.data.root.field_id,
      p_root_option_value: parsed.data.root.option_value,
      p_dependencies: JSON.parse(JSON.stringify(parsed.data.rules)) as Json,
    });
    if (error) throw error;

    await logAdminAction(supabase, auth.session.id, 'replace_service_compatibility_tree', 'services', params.id, {
      root: parsed.data.root,
      rule_count: data,
    });
    return NextResponse.json({ success: true, rule_count: data ?? 0 });
  } catch (error: unknown) {
    const message = error instanceof Error ? dependencyErrorMessage(error.message) : 'Não foi possível salvar as compatibilidades.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireApiAdminPermission('manage_catalog');
  if (!auth.success) return auth.errorResponse;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'ID do serviço inválido.' }, { status: 400 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!isUuid(id)) return NextResponse.json({ error: 'ID do vínculo inválido.' }, { status: 400 });

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('service_field_option_dependencies')
      .delete()
      .eq('id', id)
      .eq('service_id', params.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Vínculo não encontrado.' }, { status: 404 });

    await logAdminAction(supabase, auth.session.id, 'delete_service_field_option_dependency', 'service_field_option_dependencies', id, {
      service_id: params.id,
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? dependencyErrorMessage(error.message) : 'Não foi possível excluir o vínculo.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
