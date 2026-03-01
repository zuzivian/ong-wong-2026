import { NextRequest, NextResponse } from 'next/server';
import { UNLOCK_COOKIE_NAME, verifyUnlockSession } from './src/lib/invite-unlock';

const PUBLIC_PATHS = new Set([
  '/',
  '/unlock',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }

  if (pathname.startsWith('/_next/')) {
    return true;
  }

  if (pathname === '/api/unlock' || pathname.startsWith('/api/unlock/')) {
    return true;
  }

  if (pathname === '/unlock' || pathname.startsWith('/unlock/')) {
    return true;
  }

  // Public assets under /public are requested as /<file.ext>.
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return true;
  }

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const sessionValue = request.cookies.get(UNLOCK_COOKIE_NAME)?.value;
  const isUnlocked = await verifyUnlockSession(sessionValue);
  if (isUnlocked) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = '/unlock';
  redirectUrl.search = '';
  redirectUrl.searchParams.set('next', `${pathname}${search}`);

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/((?!_next).*)'],
};
