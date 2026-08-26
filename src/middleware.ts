import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { validateCsrfOrigin } from '@/lib/security/csrf';

// Keep this as Edge Middleware. Next.js 16 Proxy runs only on Node.js, which
// Cloudflare Workers cannot execute at the request-interception boundary.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtectedDashboard = pathname.startsWith('/dashboard');
  const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');
  const isProtectedAdminPage = isAdminPath && pathname !== '/admin/login';
  const isAdminApiPath = pathname === '/api/admin' || pathname.startsWith('/api/admin/');
  const requiresAdmin = isProtectedAdminPage || isAdminApiPath;
  const isStateChangingAdminApi = isAdminApiPath
    && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);

  if (!isProtectedDashboard && !requiresAdmin) {
    return NextResponse.next({
      request: { headers: request.headers },
    });
  }

  // The admin session is cookie-based. Enforce the same-origin boundary once
  // at the edge for every mutating admin API, rather than relying on each
  // individual Route Handler to remember this control.
  if (isStateChangingAdminApi && !validateCsrfOrigin(
    request.headers.get('origin'),
    request.headers.get('host'),
  )) {
    return NextResponse.json(
      { error: 'Requisição não autorizada.' },
      { status: 403 },
    );
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let user = null;
  let isActiveAdmin = false;

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
    try {
      const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) => {
                request.cookies.set(name, value);
              });
              supabaseResponse = NextResponse.next({ request });
              cookiesToSet.forEach(({ name, value, options }) => {
                supabaseResponse.cookies.set(name, value, options);
              });
            },
          },
        },
      );

      const { data } = await supabase.auth.getUser();
      user = data.user;

      if (requiresAdmin && user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        isActiveAdmin = Boolean(adminUser);
      }
    } catch {
      user = null;
    }
  }

  if (isProtectedDashboard && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (isAdminApiPath && !user) {
    return NextResponse.json(
      { error: 'Não autenticado. Por favor faça login no painel administrativo.' },
      { status: 401 },
    );
  }

  if (isAdminApiPath && !isActiveAdmin) {
    return NextResponse.json(
      { error: 'Acesso negado ao painel administrativo.' },
      { status: 403 },
    );
  }

  if (isProtectedAdminPage && (!user || !isActiveAdmin)) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
