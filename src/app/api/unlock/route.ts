import { NextRequest, NextResponse } from 'next/server';
import { DbConnection } from '@/module_bindings';
import {
  createUnlockSession,
  UNLOCK_COOKIE_NAME,
  UNLOCK_SESSION_TTL_SECONDS,
} from '@/lib/invite-unlock';

export const runtime = 'nodejs';

type UnlockRequestBody = {
  inviteCode?: unknown;
};

const DEFAULT_QUERY_TIMEOUT_MS = 8000;

function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase();
}

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

async function inviteCodeExistsInGuestTable(inviteCode: string): Promise<boolean> {
  const config = getSpacetimeConfig();
  if (!config) {
    throw new Error('SpacetimeDB host/database is not configured.');
  }

  const normalizedCode = normalizeInviteCode(inviteCode);
  if (!normalizedCode) {
    return false;
  }

  return new Promise<boolean>((resolve, reject) => {
    let settled = false;
    let connection: DbConnection | null = null;

    const timeout = setTimeout(() => {
      settleReject(new Error('Timed out while validating invite code.'));
    }, DEFAULT_QUERY_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeout);
      if (connection) {
        connection.disconnect();
      }
    };

    const settleResolve = (value: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };

    const settleReject = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    try {
      connection = DbConnection.builder()
        .withUri(normalizeToWsUri(config.host))
        .withDatabaseName(config.databaseName)
        .onConnect((ctx) => {
          const escapedCode = escapeSqlLiteral(normalizedCode);
          ctx.subscriptionBuilder()
            .onApplied((subscriptionCtx) => {
              const guestTable = (subscriptionCtx.db as Record<string, { iter(): Iterable<{ inviteCode: string }> }>)
                .guest;
              const isMatch =
                guestTable !== undefined &&
                Array.from(guestTable.iter()).some(
                  (row) => normalizeInviteCode(row.inviteCode) === normalizedCode
                );
              settleResolve(isMatch);
            })
            .onError((errorCtx) => {
              const eventError =
                errorCtx.event instanceof Error
                  ? errorCtx.event
                  : new Error('Subscription failed while validating invite code.');
              settleReject(eventError);
            })
            .subscribe([
              `SELECT * FROM guest WHERE inviteCode = '${escapedCode}'`,
            ]);
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
  const body = (await request.json().catch(() => null)) as UnlockRequestBody | null;
  const inviteCode = normalizeInviteCode(typeof body?.inviteCode === 'string' ? body.inviteCode : '');

  if (!inviteCode) {
    return NextResponse.json(
      { ok: false, error: 'Invite code is required.' },
      { status: 400 }
    );
  }

  let isInviteCodeValid = false;
  try {
    isInviteCodeValid = await inviteCodeExistsInGuestTable(inviteCode);
  } catch (error) {
    console.error('[unlock] Failed to validate invite code against guest table:', error);
    return NextResponse.json(
      { ok: false, error: 'Unlock service is temporarily unavailable. Please try again shortly.' },
      { status: 503 }
    );
  }

  if (!isInviteCodeValid) {
    return NextResponse.json(
      { ok: false, error: 'Invite code is invalid. Please check your invitation.' },
      { status: 401 }
    );
  }

  const session = await createUnlockSession();
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
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  emptyUnlockCookie(response);
  return response;
}
