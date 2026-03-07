import { NextRequest, NextResponse } from 'next/server';
import { DbConnection } from '@/module_bindings';
import {
  createUnlockSession,
  UNLOCK_COOKIE_NAME,
  UNLOCK_SESSION_TTL_SECONDS,
} from '@/lib/invite-unlock';

export const runtime = 'nodejs';

const DEFAULT_QUERY_TIMEOUT_MS = 8000;

function normalizeToWsUri(input: string): string {
  const parsed = new URL(input);
  if (parsed.protocol === 'https:') {
    parsed.protocol = 'wss:';
  } else if (parsed.protocol === 'http:') {
    parsed.protocol = 'ws:';
  }
  return parsed.toString();
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function getSpacetimeConfig(): { host: string; databaseName: string } | null {
  const host = process.env.SPACETIMEDB_HOST ?? process.env.NEXT_PUBLIC_SPACETIMEDB_HOST ?? '';
  const databaseName =
    process.env.SPACETIMEDB_DB_NAME ?? process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME ?? '';

  if (!host.trim() || !databaseName.trim()) {
    return null;
  }

  return { host: host.trim(), databaseName: databaseName.trim() };
}

async function findInviteCodeByQrToken(qrToken: string): Promise<string | null> {
  const config = getSpacetimeConfig();
  if (!config) {
    throw new Error('SpacetimeDB host/database is not configured.');
  }

  const normalizedToken = qrToken.trim();
  if (!normalizedToken) {
    return null;
  }

  return new Promise<string | null>((resolve, reject) => {
    let settled = false;
    let connection: DbConnection | null = null;

    const timeout = setTimeout(() => {
      settleReject(new Error('Timed out while validating QR token.'));
    }, DEFAULT_QUERY_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeout);
      if (connection) {
        connection.disconnect();
      }
    };

    const settleResolve = (value: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const settleReject = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    try {
      connection = DbConnection.builder()
        .withUri(normalizeToWsUri(config.host))
        .withDatabaseName(config.databaseName)
        .onConnect((ctx) => {
          const escapedToken = escapeSqlLiteral(normalizedToken);
          ctx.subscriptionBuilder()
            .onApplied((subscriptionCtx) => {
              const guestTable = (
                subscriptionCtx.db as Record<
                  string,
                  { iter(): Iterable<{ qrToken: string; inviteCode: string }> }
                >
              ).guest;
              if (!guestTable) {
                settleResolve(null);
                return;
              }
              const guest = Array.from(guestTable.iter()).find(
                (row) => row.qrToken === normalizedToken
              );
              settleResolve(guest?.inviteCode ?? null);
            })
            .onError((errorCtx) => {
              const eventError =
                errorCtx.event instanceof Error
                  ? errorCtx.event
                  : new Error('Subscription failed while validating QR token.');
              settleReject(eventError);
            })
            .subscribe([`SELECT * FROM guest WHERE qrToken = '${escapedToken}'`]);
        })
        .onConnectError((_ctx, error) => {
          settleReject(error);
        })
        .build();
    } catch (error) {
      settleReject(error instanceof Error ? error : new Error('Unable to connect to SpacetimeDB.'));
    }
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
