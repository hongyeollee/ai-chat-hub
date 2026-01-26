import createMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const intlMiddleware = createMiddleware({
  locales: ['ko', 'en'],
  defaultLocale: 'ko',
  localePrefix: 'always',
});

export async function middleware(request: NextRequest) {
  // Handle locale routing first
  const pathname = request.nextUrl.pathname;

  // Skip API routes and static files
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Apply intl middleware
  const intlResponse = intlMiddleware(request);

  // Update Supabase session
  const supabaseResponse = await updateSession(request);

  // If supabase middleware wants to redirect, use that response
  if (supabaseResponse.headers.get('location')) {
    return supabaseResponse;
  }

  // Copy supabase cookies to intl response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value, {
      ...cookie,
    });
  });

  return intlResponse;
}

export const config = {
  matcher: ['/', '/(ko|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
