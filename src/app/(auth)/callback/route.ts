import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function getSafeNextPath(next: string | null) {
  if (next?.startsWith('/') && !next.startsWith('//')) {
    return next;
  }

  return '/dashboard';
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = getSafeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user) {
      const user = data.user;
      // Check if this is an OAuth sign-in (identities contains oauth provider)
      const isOAuth = user.identities?.some(
        (identity) => identity.provider !== 'email'
      );

      if (isOAuth) {
        // Block OAuth for admins
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('id', user.id)
          .single();

        if (adminUser) {
          // It's an admin trying to use OAuth. We must reject.
          await supabase.auth.signOut();
          return NextResponse.redirect(`${origin}/login?error=AdminAccessRequiresPassword`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=InvalidAuthCode`);
}
