import { NextRequest, NextResponse } from 'next/server';
import { getGuestPreviewByInviteCode } from '@/lib/spacetimedb-procedures';
import { withSpacetimeConnection } from '@/lib/spacetimedb-server';
import {
  createUnlockSession,
  readUnlockSession,
  UNLOCK_COOKIE_NAME,
  UNLOCK_SESSION_TTL_SECONDS,
} from '@/lib/invite-unlock';
import {
  consumeRateLimit,
  getRequestClientKey,
  resetRateLimit,
} from '@/lib/request-rate-limit';

export const runtime = 'nodejs';

type UnlockRequestBody = {
  inviteCode?: unknown;
};

type UnlockSessionResponse = {
  ok: boolean;
  inviteCode: string | null;
};

const UNLOCK_RATE_LIMIT = {
  maxAttempts: 10,
  windowMs: 10 * 60 * 1000,
} as const;

function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '');
}

async function inviteCodeExistsInGuestTable(inviteCode: string): Promise<boolean> {
  const normalizedCode = normalizeInviteCode(inviteCode);
  if (!normalizedCode) {
    return false;
  }

  return withSpacetimeConnection(async (connection) => {
    const preview = await getGuestPreviewByInviteCode(connection, {
      inviteCode: normalizedCode,
    });
    return preview !== undefined;
  });
}

function emptyUnlockCookie(response: NextResponse): void {
  response.cookies.set({
    name: UNLOCK_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function POST(request: NextRequest) {
  const clientKey = getRequestClientKey(request);
  const rateLimit = consumeRateLimit('unlock', clientKey, UNLOCK_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many unlock attempts. Please wait a few minutes and try again.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const body = (await request.json().catch(() => null)) as UnlockRequestBody | null;
  const inviteCode = normalizeInviteCode(typeof body?.inviteCode === 'string' ? body.inviteCode : '');

  if (!inviteCode) {
    return NextResponse.json(
      { ok: false, error: 'Please enter your invite code.' },
      { status: 400 }
    );
  }

  let isInviteCodeValid = false;
  try {
    isInviteCodeValid = await inviteCodeExistsInGuestTable(inviteCode);
  } catch (error) {
    console.error('[unlock] Failed to validate invite code against guest table:', error);
    return NextResponse.json(
      { ok: false, error: 'We are having trouble opening invitations right now. Please try again shortly.' },
      { status: 503 }
    );
  }

  if (!isInviteCodeValid) {
    return NextResponse.json(
      { ok: false, error: 'That invite code does not match our list. Please check your invitation and try again.' },
      { status: 401 }
    );
  }

  const session = await createUnlockSession(inviteCode);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: 'Invite unlock secret is missing. Please contact the hosts.' },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: UNLOCK_COOKIE_NAME,
    value: session,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: UNLOCK_SESSION_TTL_SECONDS,
  });
  resetRateLimit('unlock', clientKey);
  return response;
}

export async function GET(request: NextRequest) {
  const sessionValue = request.cookies.get(UNLOCK_COOKIE_NAME)?.value;
  const session = await readUnlockSession(sessionValue);

  if (!session) {
    return NextResponse.json<UnlockSessionResponse>(
      { ok: false, inviteCode: null },
      {
        status: 401,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  return NextResponse.json<UnlockSessionResponse>(
    { ok: true, inviteCode: session.inviteCode ?? null },
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  emptyUnlockCookie(response);
  return response;
}
