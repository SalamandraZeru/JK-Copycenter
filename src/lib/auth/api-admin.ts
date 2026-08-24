import { NextResponse } from 'next/server';
import { getAdminSession, type AdminUserSession } from './admin';
import { canPerform, type AdminAction } from './permissions';

export type ApiAuthResult =
  | { success: true; session: AdminUserSession; errorResponse: null }
  | { success: false; session: null; errorResponse: NextResponse };

/**
 * Validates admin permission specifically for API Route Handlers.
 * Returns a JSON error response instead of calling next/navigation redirect().
 */
export async function requireApiAdminPermission(action: AdminAction): Promise<ApiAuthResult> {
  const session = await getAdminSession();

  if (!session) {
    return {
      success: false,
      session: null,
      errorResponse: NextResponse.json(
        { error: 'Não autenticado. Por favor faça login no painel administrativo.' },
        { status: 401 }
      ),
    };
  }

  if (!canPerform(session.role, action)) {
    return {
      success: false,
      session: null,
      errorResponse: NextResponse.json(
        { error: `Acesso negado. O seu perfil (${session.role}) não tem permissão para ${action}.` },
        { status: 403 }
      ),
    };
  }

  return {
    success: true,
    session,
    errorResponse: null,
  };
}
