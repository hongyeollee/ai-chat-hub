import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const locale = pathname.split('/')[1];
  const validLocales = ['en', 'ko'];
  const isValidLocale = validLocales.includes(locale);

  const pathWithoutLocale = isValidLocale
    ? pathname.replace(`/${locale}`, '') || '/'
    : pathname;

  // Protected routes - redirect to login if not authenticated
  const protectedPaths = ['/chat'];
  const isProtectedRoute = protectedPaths.some(path =>
    pathWithoutLocale.startsWith(path)
  );

  // Auth routes - redirect to chat if already authenticated
  const authPaths = ['/login', '/signup', '/verify'];
  const isAuthRoute = authPaths.some(path =>
    pathWithoutLocale.startsWith(path)
  );

  if (isProtectedRoute && !user) {
    const localePrefix = isValidLocale ? `/${locale}` : '/ko';
    const url = request.nextUrl.clone();
    url.pathname = `${localePrefix}/login`;
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const localePrefix = isValidLocale ? `/${locale}` : '/ko';
    const url = request.nextUrl.clone();
    url.pathname = `${localePrefix}/chat`;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
