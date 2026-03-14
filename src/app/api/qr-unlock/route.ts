import { NextRequest, NextResponse } from 'next/server';
import { getInviteCodeByQrToken } from '@/lib/spacetimedb-procedures';
import { withSpacetimeConnection } from '@/lib/spacetimedb-server';
import {
  createUnlockSession,
  UNLOCK_COOKIE_NAME,
  UNLOCK_SESSION_TTL_SECONDS,
} from '@/lib/invite-unlock';

export const runtime = 'nodejs';

async function findInviteCodeByQrToken(qrToken: string): Promise<string | null> {
  const normalizedToken = qrToken.trim();
  if (!normalizedToken) {
    return null;
  }

  return withSpacetimeConnection(async (connection) => {
    const inviteCode = await getInviteCodeByQrToken(connection, {
      qrToken: normalizedToken,
    });
    return inviteCode ?? null;
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() ?? '';

  if (!token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  let inviteCode: string | null = null;
  try {
    inviteCode = await findInviteCodeByQrToken(token);
  } catch (error) {
    console.error('[qr-unlock] Failed to validate QR token:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!inviteCode) {
    // Token not found — redirect to home rather than exposing details.
    return NextResponse.redirect(new URL('/', request.url));
  }

  const session = await createUnlockSession(inviteCode);
  const redirectUrl = new URL(`/rsvp/${encodeURIComponent(token)}`, request.url);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set({
    name: UNLOCK_COOKIE_NAME,
    value: session,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: UNLOCK_SESSION_TTL_SECONDS,
  });
  return response;
}
