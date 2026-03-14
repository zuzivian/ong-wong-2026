import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminSession,
  validateAdminPin,
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
} from '@/lib/admin-auth';
import {
  consumeRateLimit,
  getRequestClientKey,
  resetRateLimit,
} from '@/lib/request-rate-limit';

const ADMIN_AUTH_RATE_LIMIT = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
} as const;

export async function POST(request: NextRequest) {
  const clientKey = getRequestClientKey(request);
  const rateLimit = consumeRateLimit('admin-auth', clientKey, ADMIN_AUTH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many admin login attempts. Please wait a while and try again.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const body = (await request.json().catch(() => null)) as { pin?: unknown } | null;
  const pin = typeof body?.pin === 'string' ? body.pin : '';

  if (!validateAdminPin(pin)) {
    return NextResponse.json({ error: 'Incorrect PIN.' }, { status: 401 });
  }

  const session = await createAdminSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: session,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
  resetRateLimit('admin-auth', clientKey);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
