import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { DbConnection } from '@/module_bindings';
import { ADMIN_COOKIE_NAME, readAdminSession } from '@/lib/admin-auth';
import {
  readSpacetimeAdminCredentials,
  writeSpacetimeAdminCredentials,
} from '@/lib/spacetimedb-admin-credentials';
import { serializeSpacetimeObject } from '@/lib/spacetime-json';
import {
  getAdminDashboardSnapshot,
  getAdminGuestPage,
  getAdminInviteCodes,
  getAdminMessagePage,
} from '@/lib/spacetimedb-procedures';
import { withSpacetimeConnection } from '@/lib/spacetimedb-server';
import { ADMIN_IDENTITY_BOOTSTRAP_MARKER } from '../../../../../shared/admin-identity';

export const runtime = 'nodejs';

type AdminActionBody =
  | {
      action: 'updateGuestRsvp';
      guestId: string;
      rsvpStatus: string;
      dietaryNotes?: string;
      notes?: string;
      contactEmail?: string;
      contactPhone?: string;
    }
  | {
      action: 'replaceGuestCompanions';
      guestId: string;
      companions: Array<{
        name: string;
        dietaryNotes?: string;
        relationship?: string;
      }>;
    }
  | {
      action: 'bulkSetRsvpStatus';
      guestIds: string[];
      rsvpStatus: string;
    }
  | {
      action: 'upsertGuest';
      firstName: string;
      lastName: string;
      inviteCode: string;
      contactEmail?: string;
      contactPhone?: string;
    }
  | {
      action: 'deleteGuest';
      guestId: string;
    }
  | {
      action: 'setGuestMessageStatus';
      messageId: string;
      status: string;
    };

function getAdminMutationSecret(): string {
  return ADMIN_IDENTITY_BOOTSTRAP_MARKER;
}

async function withAdminSpacetimeConnection<T>(
  run: (connection: DbConnection) => Promise<T>
): Promise<T> {
  const storedCredentials = await readSpacetimeAdminCredentials();
  let nextCredentials: { identity: string; token: string } | null = null;

  const result = await withSpacetimeConnection(
    async (connection) => {
      const token = connection.token?.trim();
      const identity = connection.identity?.toHexString();
      if (!token || !identity) {
        throw new Error('SpacetimeDB admin connection did not return reusable credentials.');
      }

      if (storedCredentials && storedCredentials.identity !== identity) {
        throw new Error('Stored SpacetimeDB admin credentials resolved to a different identity.');
      }

      const value = await run(connection);
      nextCredentials = { identity, token };
      return value;
    },
    { token: storedCredentials?.token }
  );

  if (nextCredentials) {
    await writeSpacetimeAdminCredentials(nextCredentials);
  }

  return result;
}

async function ensureAdminSession(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const isAdmin = await readAdminSession(adminCookie);
  if (isAdmin) {
    return null;
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const unauthorizedResponse = await ensureAdminSession();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const adminSecret = getAdminMutationSecret();
  const view = request.nextUrl.searchParams.get('view')?.trim() ?? 'guest-page';
  const search = request.nextUrl.searchParams.get('search')?.trim() ?? undefined;
  const page = Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10);
  const pageSize = Number.parseInt(request.nextUrl.searchParams.get('pageSize') ?? '50', 10);
  const rsvpStatus = request.nextUrl.searchParams.get('rsvpStatus')?.trim() ?? undefined;
  const hasDietary = request.nextUrl.searchParams.get('hasDietary')?.trim() ?? undefined;
  const hasCompanions = request.nextUrl.searchParams.get('hasCompanions')?.trim() ?? undefined;
  const messageStatus = request.nextUrl.searchParams.get('messageStatus')?.trim() ?? undefined;

  try {
    const payload = await withAdminSpacetimeConnection(async (connection) => {
      if (view === 'guest-page') {
        return {
          guestPage: await getAdminGuestPage(connection, {
            adminSecret,
            page: Number.isFinite(page) ? page : 1,
            pageSize: Number.isFinite(pageSize) ? pageSize : 50,
            search,
            rsvpStatus,
            hasDietary,
            hasCompanions,
            messageStatus,
          }),
        };
      }

      if (view === 'message-page') {
        return {
          messagePage: await getAdminMessagePage(connection, {
            adminSecret,
            page: Number.isFinite(page) ? page : 1,
            pageSize: Number.isFinite(pageSize) ? pageSize : 50,
            search,
            status: messageStatus,
          }),
        };
      }

      if (view === 'invite-codes') {
        return {
          inviteCodes: await getAdminInviteCodes(connection, { adminSecret }),
        };
      }

      const snapshot = await getAdminDashboardSnapshot(connection, { adminSecret });
      return { snapshot };
    });

    return NextResponse.json(
      {
        ok: true,
        view,
        ...serializeSpacetimeObject(payload),
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch (error) {
    console.error('[admin/spacetimedb][GET] failed to load snapshot:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load admin dashboard data.' },
      { status: 500 }
    );
  }
}

export async function HEAD() {
  return new NextResponse(null, { status: 405 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 405 });
}

export async function POST(request: NextRequest) {
  const unauthorizedResponse = await ensureAdminSession();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const body = (await request.json().catch(() => null)) as AdminActionBody | null;
  if (!body || typeof body !== 'object' || !('action' in body)) {
    return NextResponse.json({ error: 'Invalid admin action payload.' }, { status: 400 });
  }

  const adminSecret = getAdminMutationSecret();

  try {
    await withAdminSpacetimeConnection(async (connection) => {
      switch (body.action) {
        case 'updateGuestRsvp':
          await connection.reducers.adminUpdateGuestRsvp({
            adminSecret,
            guestId: BigInt(body.guestId),
            rsvpStatus: body.rsvpStatus,
            dietaryNotes: body.dietaryNotes,
            notes: body.notes,
            contactEmail: body.contactEmail,
            contactPhone: body.contactPhone,
          });
          return;
        case 'replaceGuestCompanions':
          await connection.reducers.adminReplaceGuestCompanions({
            adminSecret,
            guestId: BigInt(body.guestId),
            companions: body.companions.map((companion) => ({
              name: companion.name,
              dietaryNotes: companion.dietaryNotes,
              relationship: companion.relationship,
            })),
          });
          return;
        case 'bulkSetRsvpStatus':
          await connection.reducers.adminBulkSetRsvpStatus({
            adminSecret,
            guestIds: body.guestIds.map((guestId) => BigInt(guestId)),
            rsvpStatus: body.rsvpStatus,
          });
          return;
        case 'upsertGuest':
          await connection.reducers.adminUpsertGuest({
            adminSecret,
            firstName: body.firstName,
            lastName: body.lastName,
            inviteCode: body.inviteCode,
            contactEmail: body.contactEmail,
            contactPhone: body.contactPhone,
          });
          return;
        case 'deleteGuest':
          await connection.reducers.adminDeleteGuest({
            adminSecret,
            guestId: BigInt(body.guestId),
          });
          return;
        case 'setGuestMessageStatus':
          await connection.reducers.adminSetGuestMessageStatus({
            adminSecret,
            messageId: BigInt(body.messageId),
            status: body.status,
          });
          return;
        default:
          throw new Error('Unknown admin action.');
      }
    });
  } catch (error) {
    console.error('[admin/spacetimedb][POST] failed admin action:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Admin action failed.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
