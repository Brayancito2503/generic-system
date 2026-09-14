import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';
import { SESSION_COOKIE, verifySessionToken } from './src/lib/session-token';

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = ['/login'];

function isPublicPath(pathname: string): boolean {
  if (/^\/(en|es)\/?$/.test(pathname)) return true;
  const publicPathnameRegex = new RegExp(
    `^(/(${routing.locales.join('|')}))?(${PUBLIC_PATHS.join('|')})?/?$`,
    'i'
  );
  return publicPathnameRegex.test(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return intlMiddleware(request);
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};