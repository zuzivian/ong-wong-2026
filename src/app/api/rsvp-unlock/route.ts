import { NextRequest, NextResponse } from 'next/server';
import { getGuestPreviewByInviteCode } from '@/lib/spacetimedb-procedures';
import { withSpacetimeConnection } from '@/lib/spacetimedb-server';
import {
  createUnlockSession,
  UNLOCK_COOKIE_NAME,
  UNLOCK_SESSION_TTL_SECONDS,
} from '@/lib/invite-unlock';
import { normalizeInviteCode } from '@/lib/unlock-client';

export const runtime = 'nodejs';

async function inviteCodeExists(inviteCode: string): Promise<boolean> {
  const normalizedCode = normalizeInviteCode(inviteCode);
  if (!normalizedCode) {
    return false;
  }

  return withSpacetimeConnection(async (connection) => {
    const preview = await getGuestPreviewByInviteCode(connection, { inviteCode: normalizedCode });
    return preview !== undefined;
  });
}

export async function GET(request: NextRequest) {
  const inviteCode = normalizeInviteCode(request.nextUrl.searchParams.get('inviteCode') ?? '');
  if (!inviteCode) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  let exists = false;
  try {
    exists = await inviteCodeExists(inviteCode);
  } catch (error) {
    console.error('[rsvp-unlock] Failed to validate invite code:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (!exists) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const session = await createUnlockSession(inviteCode);
  const redirectUrl = new URL(`/rsvp/${encodeURIComponent(inviteCode)}`, request.url);
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
