import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/admin';
import { requireApiAdminPermission } from '@/lib/auth/api-admin';
import { parseAdminJson } from '@/lib/security/admin-input';
import type { Json } from '@/types/supabase';

export const dynamic = 'force-dynamic';

function isJson(value: unknown, depth = 0): value is Json {
  if (depth > 10) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 1_000 && value.every((item) => isJson(item, depth + 1));
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    return entries.length <= 1_000
      && entries.every(([key, item]) => key.length <= 100 && isJson(item, depth + 1));
  }
  return false;
}

const settingValueSchema = z.custom<Json>((value) => isJson(value), 'Valor de configuração inválido.');

const configSchema = z.record(
  z.string().regex(/^[a-z][a-z0-9_]{0,99}$/),
  settingValueSchema
).refine((value) => Object.keys(value).length <= 100, 'Muitas configurações em uma única requisição.');

export async function GET(): Promise<NextResponse> {
  try {
    const auth = await requireApiAdminPermission('manage_config');
    if (!auth.success) return auth.errorResponse;

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('store_settings')
      .select('key, value, allowed_roles, is_sensitive')
      .order('key', { ascending: true });
    if (error) throw error;

    const visible = (data ?? []).filter((setting) =>
      setting.allowed_roles.includes(auth.session.role) && !setting.is_sensitive
    );
    const response = Object.fromEntries(visible.map((setting) => [setting.key, setting.value]));
    return NextResponse.json(response);
  } catch (caught: unknown) {
    return NextResponse.json({
      error: caught instanceof Error ? caught.message : 'Erro ao carregar configurações',
    }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireApiAdminPermission('manage_config');
    if (!auth.success) return auth.errorResponse;

    const parsed = await parseAdminJson(request, configSchema);
    if (!parsed.success) return parsed.errorResponse;
    const entries = Object.entries(parsed.data);
    if (entries.length === 0) return NextResponse.json({ success: true });

    const supabase = createServiceRoleClient();
    const keys = entries.map(([key]) => key);
    const { data: definitions, error: definitionsError } = await supabase
      .from('store_settings')
      .select('key, allowed_roles, is_sensitive')
      .in('key', keys);
    if (definitionsError) throw definitionsError;
    if (!definitions || definitions.length !== keys.length) {
      return NextResponse.json({ error: 'Uma ou mais configurações não são reconhecidas.' }, { status: 400 });
    }

    const definitionsByKey = new Map(definitions.map((definition) => [definition.key, definition]));
    const unauthorizedKey = keys.find((key) => {
      const definition = definitionsByKey.get(key);
      return !definition
        || definition.is_sensitive
        || !definition.allowed_roles.includes(auth.session.role);
    });
    if (unauthorizedKey) {
      return NextResponse.json({ error: `Sem permissão para alterar ${unauthorizedKey}.` }, { status: 403 });
    }

    for (const [key, value] of entries) {
      const { data: updated, error: updateError } = await supabase
        .from('store_settings')
        .update({ value, updated_by: auth.session.id })
        .eq('key', key)
        .select('key')
        .maybeSingle();
      if (updateError || !updated) {
        throw updateError ?? new Error(`Configuração não encontrada: ${key}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : 'Erro ao salvar configurações';
    const status = message.includes('INVALID_') || message.includes('TYPE_MISMATCH') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
