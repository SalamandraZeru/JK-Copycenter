import { NextResponse } from 'next/server';
import type { z } from 'zod';

export type ParsedInput<T> =
  | { success: true; data: T; errorResponse: null }
  | { success: false; data: null; errorResponse: NextResponse };

export async function parseAdminJson<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<ParsedInput<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      data: null,
      errorResponse: NextResponse.json({ error: 'Corpo JSON inválido.' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      success: false,
      data: null,
      errorResponse: NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      ),
    };
  }

  return { success: true, data: parsed.data, errorResponse: null };
}

export function isUuid(value: string | null | undefined): value is string {
  // PostgreSQL accepts UUIDs that do not encode a RFC 4122 version/variant.
  // The application must accept every syntactically valid PostgreSQL UUID too;
  // authorization is always enforced independently of this shape check.
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}
