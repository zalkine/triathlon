import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { verifySession, SESSION_COOKIE } from './lib/auth';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split('/').filter(Boolean);
  const locale = routing.locales.includes(segments[0] as (typeof routing.locales)[number])
    ? segments[0]
    : routing.defaultLocale;
  const pathWithoutLocale = '/' + segments.slice(segments[0] === locale ? 1 : 0).join('/');

  if (pathWithoutLocale.startsWith('/staff')) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const session = token ? await verifySession(token) : null;

    if (!session) {
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const adminOnly = pathWithoutLocale.startsWith('/staff/manage') || pathWithoutLocale.startsWith('/staff/users');
    if (adminOnly && session.role !== 'ADMIN') {
      return NextResponse.redirect(new URL(`/${locale}/staff/stations`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
