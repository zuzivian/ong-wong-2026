import { NextRequest, NextResponse } from 'next/server';
import {
  createUnlockSession,
  readUnlockSession,
  UNLOCK_COOKIE_NAME,
  UNLOCK_SESSION_TTL_SECONDS,
} from './src/lib/invite-unlock';

const PUBLIC_PATHS = new Set([
  '/',
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

  // Public assets under /public are requested as /<file.ext>.
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return true;
  }

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Legacy unlock route now lives on home.
  if (pathname === '/unlock' || pathname.startsWith('/unlock/')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const sessionValue = request.cookies.get(UNLOCK_COOKIE_NAME)?.value;
  const session = await readUnlockSession(sessionValue);
  if (session) {
    const response = NextResponse.next();
    const refreshedSession = await createUnlockSession(session.inviteCode);
    response.cookies.set({
      name: UNLOCK_COOKIE_NAME,
      value: refreshedSession,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: UNLOCK_SESSION_TTL_SECONDS,
    });
    return response;
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = '/';
  redirectUrl.search = '';

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/((?!_next).*)'],
};
