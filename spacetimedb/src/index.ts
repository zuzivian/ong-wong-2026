import { SenderError, t } from 'spacetimedb/server';
import spacetimedb, { Companion, Guest, GuestMessage, RsvpResponse } from './schema';
import { RSVP_CUTOFF_AT_MICROS } from '../../shared/globals';
import { ADMIN_IDENTITY_BOOTSTRAP_MARKER } from '../../shared/admin-identity';

export { default } from './schema';

const RSVP_MESSAGE_NEW = 'new';
const RSVP_MESSAGE_IN_PROGRESS = 'in_progress';
const RSVP_MESSAGE_RESOLVED = 'resolved';
const RSVP_STATUS_ATTENDING = 'attending';
const RSVP_STATUS_DECLINING = 'declining';
const RSVP_STATUS_PENDING = 'pending';

const CompanionInput = t.object('CompanionInput', {
  name: t.string(),
  dietaryNotes: t.string().optional(),
  relationship: t.string().optional(),
});

const GuestPreview = t.object('GuestPreview', {
  firstName: t.string(),
  lastName: t.string(),
  inviteCode: t.string(),
});

const GuestPortalState = t.object('GuestPortalState', {
  previewGuest: t.option(GuestPreview),
  activeGuest: t.option(Guest.rowType),
  activeRsvp: t.option(RsvpResponse.rowType),
  companions: t.array(Companion.rowType),
  messages: t.array(GuestMessage.rowType),
});

const AdminDashboardSnapshot = t.object('AdminDashboardSnapshot', {
  guests: t.array(Guest.rowType),
  responses: t.array(RsvpResponse.rowType),
  companions: t.array(Companion.rowType),
  messages: t.array(GuestMessage.rowType),
});

const AdminDashboardStats = t.object('AdminDashboardStats', {
  invited: t.i32(),
  attending: t.i32(),
  declining: t.i32(),
  pending: t.i32(),
  headcount: t.i32(),
  dietaryCount: t.i32(),
  companionCount: t.i32(),
});

const AdminMessageStats = t.object('AdminMessageStats', {
  total: t.i32(),
  newCount: t.i32(),
  inProgressCount: t.i32(),
  resolvedCount: t.i32(),
});

const AdminGuestPage = t.object('AdminGuestPage', {
  totalGuests: t.i32(),
  filteredGuests: t.i32(),
  totalPages: t.i32(),
  page: t.i32(),
  pageSize: t.i32(),
  stats: AdminDashboardStats,
  guests: t.array(Guest.rowType),
  responses: t.array(RsvpResponse.rowType),
  companions: t.array(Companion.rowType),
  messages: t.array(GuestMessage.rowType),
});

const AdminMessagePage = t.object('AdminMessagePage', {
  totalMessages: t.i32(),
  totalPages: t.i32(),
  page: t.i32(),
  pageSize: t.i32(),
  messageStats: AdminMessageStats,
  guests: t.array(Guest.rowType),
  messages: t.array(GuestMessage.rowType),
});

const AdminInviteCodes = t.object('AdminInviteCodes', {
  inviteCodes: t.array(t.string()),
});

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]+/g, '');
}

function normalizeOptional(text: string | undefined): string | undefined {
  if (text === undefined) {
    return undefined;
  }
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeRsvpStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (
    normalized !== RSVP_STATUS_ATTENDING &&
    normalized !== RSVP_STATUS_DECLINING &&
    normalized !== RSVP_STATUS_PENDING
  ) {
    throw new SenderError('Invalid RSVP status.');
  }
  return normalized;
}

function normalizeMessageStatus(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (
    normalized !== RSVP_MESSAGE_NEW &&
    normalized !== RSVP_MESSAGE_IN_PROGRESS &&
    normalized !== RSVP_MESSAGE_RESOLVED
  ) {
    throw new SenderError('Invalid message status.');
  }
  return normalized;
}

type ModuleContext = Parameters<typeof identify_guest_by_fallback>[0];

function requireAdminAccess(
  ctx: {
    sender: ModuleContext['sender'];
    timestamp: ModuleContext['timestamp'];
    db: ModuleContext['db'];
  },
  adminSecret: string
): void {
  const configuredAdmin = ctx.db.admin_identity.id.find(0n);
  if (!configuredAdmin) {
    if (adminSecret.trim() !== ADMIN_IDENTITY_BOOTSTRAP_MARKER) {
      throw new SenderError('Admin identity is not initialized.');
    }

    ctx.db.admin_identity.insert({
      id: 0n,
      identity: ctx.sender,
      claimedAt: ctx.timestamp,
    });
    return;
  }

  // Allow re-bootstrapping if the correct secret is provided
  if (adminSecret.trim() === ADMIN_IDENTITY_BOOTSTRAP_MARKER) {
    ctx.db.admin_identity.id.update({
      ...configuredAdmin,
      identity: ctx.sender,
      claimedAt: ctx.timestamp,
    });
    return;
  }

  if (!configuredAdmin.identity.equals(ctx.sender)) {
    throw new SenderError('Unauthorized admin action.');
  }
}

function requireGuestForSender(ctx: ModuleContext) {
  const session = ctx.db.guest_session.sender.find(ctx.sender);
  if (!session) {
    throw new SenderError('Please verify your invitation details first.');
  }

  const guest = ctx.db.guest.id.find(session.guestId);
  if (!guest) {
    throw new SenderError('Guest record not found.');
  }

  return { session, guest };
}

function requireGuestMessageForSender(
  ctx: ModuleContext,
  messageId: bigint
) {
  const { guest } = requireGuestForSender(ctx);
  const guestMessage = ctx.db.guest_message.id.find(messageId);
  if (!guestMessage) {
    throw new SenderError('Message not found.');
  }
  if (guestMessage.guestId !== guest.id) {
    throw new SenderError('You can only manage your own messages.');
  }

  return guestMessage;
}

function isRsvpCutoffReached(ctx: ModuleContext): boolean {
  return ctx.timestamp.microsSinceUnixEpoch > RSVP_CUTOFF_AT_MICROS;
}

function setGuestRsvpStatus(
  ctx: ModuleContext,
  guestId: bigint,
  status: string
): void {
  const guest = ctx.db.guest.id.find(guestId);
  if (!guest) {
    throw new SenderError('Guest not found.');
  }
  const normalizedStatus = normalizeRsvpStatus(status);

  const existingResponse = ctx.db.rsvp_response.guestId.find(guestId);
  if (normalizedStatus === RSVP_STATUS_PENDING) {
    if (existingResponse) {
      ctx.db.rsvp_response.id.delete(existingResponse.id);
    }
    for (const companion of ctx.db.companion.companion_guest_id.filter(guestId)) {
      ctx.db.companion.id.delete(companion.id);
    }
  } else {
    const attendance = normalizedStatus === RSVP_STATUS_ATTENDING;
    if (existingResponse) {
      ctx.db.rsvp_response.id.update({
        ...existingResponse,
        attendance,
        updatedAt: ctx.timestamp,
      });
    } else {
      ctx.db.rsvp_response.insert({
        id: 0n,
        guestId,
        attendance,
        dietaryNotes: undefined,
        notes: undefined,
        submitted: true,
        updatedAt: ctx.timestamp,
      });
    }
  }

  ctx.db.guest.id.update({
    ...guest,
    rsvpStatus: normalizedStatus,
    updatedAt: ctx.timestamp,
  });
}

function deleteGuestRecords(
  ctx: ModuleContext,
  guestId: bigint
): void {
  const guest = ctx.db.guest.id.find(guestId);
  if (!guest) {
    throw new SenderError('Guest not found.');
  }

  const existingResponse = ctx.db.rsvp_response.guestId.find(guestId);
  if (existingResponse) {
    ctx.db.rsvp_response.id.delete(existingResponse.id);
  }

  for (const companion of ctx.db.companion.companion_guest_id.filter(guestId)) {
    ctx.db.companion.id.delete(companion.id);
  }

  for (const message of ctx.db.guest_message.guest_message_guest_id.filter(guestId)) {
    ctx.db.guest_message.id.delete(message.id);
  }

  for (const session of ctx.db.guest_session.guest_session_guest_id.filter(guestId)) {
    ctx.db.guest_session.sender.delete(session.sender);
  }

  ctx.db.guest.id.delete(guestId);
}

function upsertGuestSession(
  ctx: ModuleContext,
  guestId: bigint
): void {
  const existing = ctx.db.guest_session.sender.find(ctx.sender);
  if (existing) {
    ctx.db.guest_session.sender.update({
      ...existing,
      guestId,
      verifiedAt: ctx.timestamp,
    });
    return;
  }

  ctx.db.guest_session.insert({
    sender: ctx.sender,
    guestId,
    verifiedAt: ctx.timestamp,
  });
}

function buildGuestPreview(
  guest:
    | {
        firstName: string;
        lastName: string;
        inviteCode: string;
      }
    | null
    | undefined
) {
  if (!guest) {
    return undefined;
  }

  return {
    firstName: guest.firstName,
    lastName: guest.lastName,
    inviteCode: guest.inviteCode,
  };
}

export const init = spacetimedb.init(() => {});

export const on_connect = spacetimedb.clientConnected(() => {});

export const on_disconnect = spacetimedb.clientDisconnected(() => {});

export const identify_guest_by_fallback = spacetimedb.reducer(
  {
    firstName: t.string(),
    lastName: t.string(),
    inviteCode: t.string(),
  },
  (ctx, { firstName, lastName, inviteCode }) => {
    const normalizedInviteCode = normalizeInviteCode(inviteCode);
    if (!normalizedInviteCode) {
      throw new SenderError('Invite code is required.');
    }

    const guest = ctx.db.guest.inviteCode.find(normalizedInviteCode);
    if (!guest) {
      throw new SenderError('Invitation record not found.');
    }

    if (
      normalize(guest.firstName) !== normalize(firstName) ||
      normalize(guest.lastName) !== normalize(lastName)
    ) {
      throw new SenderError('Name and invite code do not match.');
    }

    upsertGuestSession(ctx, guest.id);
  }
);

export const update_guest_name = spacetimedb.reducer(
  {
    firstName: t.string(),
    lastName: t.string(),
    inviteCode: t.string(),
  },
  (ctx, { firstName, lastName, inviteCode }) => {
    const normalizedInviteCode = normalizeInviteCode(inviteCode);
    if (!normalizedInviteCode) {
      throw new SenderError('Invite code is required.');
    }

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    if (!trimmedFirst || !trimmedLast) {
      throw new SenderError('First and last name are required.');
    }

    const guest = ctx.db.guest.inviteCode.find(normalizedInviteCode);
    if (!guest) {
      throw new SenderError('Invitation record not found.');
    }

    ctx.db.guest.id.update({ ...guest, firstName: trimmedFirst, lastName: trimmedLast, updatedAt: ctx.timestamp });
    upsertGuestSession(ctx, guest.id);
  }
);

export const clear_guest_session = spacetimedb.reducer(ctx => {
  const existing = ctx.db.guest_session.sender.find(ctx.sender);
  if (existing) {
    ctx.db.guest_session.sender.delete(ctx.sender);
  }
});

export const get_guest_preview_by_invite_code = spacetimedb.procedure(
  {
    inviteCode: t.string(),
  },
  t.option(GuestPreview),
  (ctx, { inviteCode }) => {
    const normalizedInviteCode = normalizeInviteCode(inviteCode);
    if (!normalizedInviteCode) {
      return undefined;
    }

    return ctx.withTx(tx => {
      const guest = tx.db.guest.inviteCode.find(normalizedInviteCode);
      return buildGuestPreview(guest);
    });
  }
);

export const get_guest_portal_state = spacetimedb.procedure(
  {
    inviteCode: t.string().optional(),
  },
  GuestPortalState,
  (ctx, { inviteCode }) => {
    const normalizedInviteCode = normalizeOptional(inviteCode);

    return ctx.withTx(tx => {
      const session = tx.db.guest_session.sender.find(tx.sender);
      const sessionGuest = session ? tx.db.guest.id.find(session.guestId) ?? undefined : undefined;
      const inviteCodeGuest = normalizedInviteCode
        ? tx.db.guest.inviteCode.find(normalizedInviteCode) ?? undefined
        : undefined;
      const resolvedGuest = sessionGuest ?? inviteCodeGuest;
      const previewGuest = buildGuestPreview(inviteCodeGuest);
      const activeRsvp = resolvedGuest
        ? tx.db.rsvp_response.guestId.find(resolvedGuest.id) ?? undefined
        : undefined;
      const companions = resolvedGuest
        ? [...tx.db.companion.companion_guest_id.filter(resolvedGuest.id)]
        : [];
      const messages = resolvedGuest
        ? [...tx.db.guest_message.guest_message_guest_id.filter(resolvedGuest.id)]
        : [];

      return {
        previewGuest,
        activeGuest: resolvedGuest,
        activeRsvp,
        companions,
        messages,
      };
    });
  }
);

export const get_admin_dashboard_snapshot = spacetimedb.procedure(
  {
    adminSecret: t.string(),
  },
  AdminDashboardSnapshot,
  (ctx, { adminSecret }) => {
    return ctx.withTx(tx => {
      requireAdminAccess(tx, adminSecret);

      return {
        guests: [...tx.db.guest.iter()],
        responses: [...tx.db.rsvp_response.iter()],
        companions: [...tx.db.companion.iter()],
        messages: [...tx.db.guest_message.iter()],
      };
    });
  }
);

function compareGuests(a: any, b: any): number {
  const statusOrder = (status: string) => {
    if (status === RSVP_STATUS_ATTENDING) return 0;
    if (status === RSVP_STATUS_DECLINING) return 1;
    return 2;
  };

  const order = statusOrder(a.rsvpStatus) - statusOrder(b.rsvpStatus);
  if (order !== 0) {
    return order;
  }

  return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
}

function matchesGuestSearch(guest: any, searchNeedle: string): boolean {
  if (!searchNeedle) {
    return true;
  }

  const searchable = [
    `${guest.firstName} ${guest.lastName}`,
    guest.inviteCode,
    guest.contactEmail ?? '',
    guest.contactPhone ?? '',
  ]
    .join(' ')
    .toLowerCase();

  return searchable.includes(searchNeedle);
}

function buildAdminDashboardStats(
  guests: any[],
  getResponse: (guestId: bigint) => any,
  getCompanions: (guestId: bigint) => any[]
) {
  let attending = 0;
  let declining = 0;
  let pending = 0;
  let companionCount = 0;
  let dietaryCount = 0;

  for (const guest of guests) {
    if (guest.rsvpStatus === RSVP_STATUS_ATTENDING) attending += 1;
    else if (guest.rsvpStatus === RSVP_STATUS_DECLINING) declining += 1;
    else pending += 1;

    const guestCompanions = getCompanions(guest.id);
    if (guest.rsvpStatus === RSVP_STATUS_ATTENDING) {
      companionCount += guestCompanions.length;
    }

    const response = getResponse(guest.id);
    if (response?.dietaryNotes || guestCompanions.some((companion) => companion.dietaryNotes)) {
      dietaryCount += 1;
    }
  }

  return {
    invited: guests.length,
    attending,
    declining,
    pending,
    headcount: attending + companionCount,
    dietaryCount,
    companionCount,
  };
}

function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) {
    return 1;
  }
  if (page < 1) {
    return 1;
  }
  if (page > totalPages) {
    return totalPages;
  }
  return page;
}

export const get_admin_guest_page = spacetimedb.procedure(
  {
    adminSecret: t.string(),
    page: t.i32(),
    pageSize: t.i32(),
    search: t.string().optional(),
    rsvpStatus: t.string().optional(),
    hasDietary: t.string().optional(),
    hasCompanions: t.string().optional(),
    messageStatus: t.string().optional(),
  },
  AdminGuestPage,
  (ctx, params) => {
    return ctx.withTx(tx => {
      requireAdminAccess(tx, params.adminSecret);

      const searchNeedle = normalizeOptional(params.search)?.toLowerCase() ?? '';
      const normalizedStatus = normalizeOptional(params.rsvpStatus);
      const hasDietary = normalizeOptional(params.hasDietary);
      const hasCompanions = normalizeOptional(params.hasCompanions);
      const messageStatus = normalizeOptional(params.messageStatus);

      const allGuests = [...tx.db.guest.iter()].sort(compareGuests);
      const getResponse = (guestId: bigint) => tx.db.rsvp_response.guestId.find(guestId) ?? undefined;
      const getCompanions = (guestId: bigint) => [...tx.db.companion.companion_guest_id.filter(guestId)];
      const getMessages = (guestId: bigint) => [...tx.db.guest_message.guest_message_guest_id.filter(guestId)];

      const filteredGuests = allGuests.filter((guest) => {
        const response = getResponse(guest.id);
        const companions = getCompanions(guest.id);
        const messages = getMessages(guest.id);

        if (!matchesGuestSearch(guest, searchNeedle)) {
          return false;
        }

        if (normalizedStatus && normalizedStatus !== 'all' && guest.rsvpStatus !== normalizedStatus) {
          return false;
        }

        const hasDietaryNotes = Boolean(response?.dietaryNotes) || companions.some((companion) => companion.dietaryNotes);
        if (hasDietary === 'yes' && !hasDietaryNotes) {
          return false;
        }
        if (hasDietary === 'no' && hasDietaryNotes) {
          return false;
        }

        const hasCompanionRows = companions.length > 0;
        if (hasCompanions === 'yes' && !hasCompanionRows) {
          return false;
        }
        if (hasCompanions === 'no' && hasCompanionRows) {
          return false;
        }

        if (messageStatus) {
          if (messageStatus === 'none') {
            return messages.length === 0;
          }

          return messages.some((message) => message.status === messageStatus);
        }

        return true;
      });

      const safePageSize = Math.max(1, Math.min(params.pageSize, 100));
      const totalPages = Math.max(1, Math.ceil(filteredGuests.length / safePageSize));
      const page = clampPage(params.page, totalPages);
      const start = (page - 1) * safePageSize;
      const pageGuests = filteredGuests.slice(start, start + safePageSize);

      return {
        totalGuests: allGuests.length,
        filteredGuests: filteredGuests.length,
        totalPages,
        page,
        pageSize: safePageSize,
        stats: buildAdminDashboardStats(allGuests, getResponse, getCompanions),
        guests: pageGuests,
        responses: pageGuests
          .map((guest) => getResponse(guest.id))
          .filter((row) => row !== undefined),
        companions: pageGuests.flatMap((guest) => getCompanions(guest.id)),
        messages: pageGuests.flatMap((guest) => getMessages(guest.id)),
      };
    });
  }
);

export const get_admin_message_page = spacetimedb.procedure(
  {
    adminSecret: t.string(),
    page: t.i32(),
    pageSize: t.i32(),
    search: t.string().optional(),
    status: t.string().optional(),
  },
  AdminMessagePage,
  (ctx, params) => {
    return ctx.withTx(tx => {
      requireAdminAccess(tx, params.adminSecret);

      const searchNeedle = normalizeOptional(params.search)?.toLowerCase() ?? '';
      const normalizedStatus = normalizeOptional(params.status);
      const allMessages = [...tx.db.guest_message.iter()].sort((a, b) =>
        b.createdAt.microsSinceUnixEpoch > a.createdAt.microsSinceUnixEpoch ? 1 : -1
      );

      const filteredMessages = allMessages.filter((message) => {
        if (normalizedStatus && normalizedStatus !== 'all' && message.status !== normalizedStatus) {
          return false;
        }

        if (!searchNeedle) {
          return true;
        }

        const guest = tx.db.guest.id.find(message.guestId);
        const searchable = [
          message.message,
          guest ? `${guest.firstName} ${guest.lastName}` : '',
          guest?.inviteCode ?? '',
        ]
          .join(' ')
          .toLowerCase();

        return searchable.includes(searchNeedle);
      });

      const safePageSize = Math.max(1, Math.min(params.pageSize, 100));
      const totalPages = Math.max(1, Math.ceil(filteredMessages.length / safePageSize));
      const page = clampPage(params.page, totalPages);
      const start = (page - 1) * safePageSize;
      const pageMessages = filteredMessages.slice(start, start + safePageSize);
      const guestIds = [...new Set(pageMessages.map((message) => message.guestId.toString()))].map((id) =>
        BigInt(id)
      );

      let newCount = 0;
      let inProgressCount = 0;
      let resolvedCount = 0;
      for (const message of allMessages) {
        if (message.status === RSVP_MESSAGE_NEW) newCount += 1;
        else if (message.status === RSVP_MESSAGE_IN_PROGRESS) inProgressCount += 1;
        else if (message.status === RSVP_MESSAGE_RESOLVED) resolvedCount += 1;
      }

      return {
        totalMessages: filteredMessages.length,
        totalPages,
        page,
        pageSize: safePageSize,
        messageStats: {
          total: allMessages.length,
          newCount,
          inProgressCount,
          resolvedCount,
        },
        guests: guestIds
          .map((guestId) => tx.db.guest.id.find(guestId))
          .filter((guest): guest is NonNullable<typeof guest> => guest != null),
        messages: pageMessages,
      };
    });
  }
);

export const get_admin_invite_codes = spacetimedb.procedure(
  {
    adminSecret: t.string(),
  },
  AdminInviteCodes,
  (ctx, { adminSecret }) => {
    return ctx.withTx(tx => {
      requireAdminAccess(tx, adminSecret);
      return {
        inviteCodes: [...tx.db.guest.iter()].map((guest) => guest.inviteCode),
      };
    });
  }
);

export const update_guest_phone = spacetimedb.reducer(
  {
    contactPhone: t.string().optional(),
  },
  (ctx, { contactPhone }) => {
    const { guest } = requireGuestForSender(ctx);
    const normalizedPhone = normalizeOptional(contactPhone);
    ctx.db.guest.id.update({
      ...guest,
      contactPhone: normalizedPhone,
      updatedAt: ctx.timestamp,
    });
  }
);

export const submit_rsvp = spacetimedb.reducer(
  {
    attendance: t.bool(),
    dietaryNotes: t.string().optional(),
    notes: t.string().optional(),
    contactEmail: t.string().optional(),
    contactPhone: t.string().optional(),
    companions: t.array(CompanionInput),
    submitted: t.bool(),
  },
  (ctx, payload) => {
    if (isRsvpCutoffReached(ctx)) {
      throw new SenderError('RSVP edits are closed.');
    }

    const { session, guest } = requireGuestForSender(ctx);

    const nextDietaryNotes = normalizeOptional(payload.dietaryNotes);
    const nextNotes = normalizeOptional(payload.notes);
    const nextContactEmail = normalizeOptional(payload.contactEmail);
    const nextContactPhone = normalizeOptional(payload.contactPhone);

    const existingResponse = ctx.db.rsvp_response.guestId.find(guest.id);
    if (existingResponse) {
      ctx.db.rsvp_response.id.update({
        ...existingResponse,
        attendance: payload.attendance,
        dietaryNotes: nextDietaryNotes,
        notes: nextNotes,
        submitted: payload.submitted || existingResponse.submitted,
        updatedAt: ctx.timestamp,
      });
    } else {
      ctx.db.rsvp_response.insert({
        id: 0n,
        guestId: guest.id,
        attendance: payload.attendance,
        dietaryNotes: nextDietaryNotes,
        notes: nextNotes,
        submitted: payload.submitted,
        updatedAt: ctx.timestamp,
      });
    }

    const maxCompanions = 5;
    const normalizedCompanions = payload.companions
      .map(companion => ({
        name: companion.name.trim(),
        dietaryNotes: normalizeOptional(companion.dietaryNotes),
        relationship: normalizeOptional(companion.relationship),
      }))
      .filter(companion => companion.name.length > 0);

    for (const existingCompanion of ctx.db.companion.companion_guest_id.filter(guest.id)) {
      ctx.db.companion.id.delete(existingCompanion.id);
    }

    if (payload.attendance && maxCompanions > 0) {
      for (const companion of normalizedCompanions.slice(0, maxCompanions)) {
        ctx.db.companion.insert({
          id: 0n,
          guestId: guest.id,
          name: companion.name,
          dietaryNotes: companion.dietaryNotes,
          relationship: companion.relationship,
          updatedAt: ctx.timestamp,
        });
      }
    }

    ctx.db.guest.id.update({
      ...guest,
      rsvpStatus: payload.attendance ? RSVP_STATUS_ATTENDING : RSVP_STATUS_DECLINING,
      contactEmail: payload.contactEmail !== undefined ? nextContactEmail : guest.contactEmail,
      contactPhone: payload.contactPhone !== undefined ? nextContactPhone : guest.contactPhone,
      updatedAt: ctx.timestamp,
    });

    ctx.db.guest_session.sender.update({
      ...session,
      verifiedAt: ctx.timestamp,
    });
  }
);

export const send_guest_message = spacetimedb.reducer(
  {
    message: t.string(),
  },
  (ctx, { message }) => {
    const trimmed = message.trim();
    if (!trimmed) {
      throw new SenderError('Message is required.');
    }

    const { guest } = requireGuestForSender(ctx);

    ctx.db.guest_message.insert({
      id: 0n,
      guestId: guest.id,
      message: trimmed,
      status: RSVP_MESSAGE_NEW,
      createdAt: ctx.timestamp,
    });
  }
);

export const update_guest_message = spacetimedb.reducer(
  {
    messageId: t.u64(),
    message: t.string(),
  },
  (ctx, { messageId, message }) => {
    const trimmed = message.trim();
    if (!trimmed) {
      throw new SenderError('Message is required.');
    }

    const existingMessage = requireGuestMessageForSender(ctx, messageId);
    ctx.db.guest_message.id.update({
      ...existingMessage,
      message: trimmed,
      status: RSVP_MESSAGE_NEW,
    });
  }
);

export const delete_guest_message = spacetimedb.reducer(
  {
    messageId: t.u64(),
  },
  (ctx, { messageId }) => {
    const existingMessage = requireGuestMessageForSender(ctx, messageId);
    ctx.db.guest_message.id.delete(existingMessage.id);
  }
);

export const admin_update_guest_rsvp = spacetimedb.reducer(
  {
    adminSecret: t.string(),
    guestId: t.u64(),
    rsvpStatus: t.string(),
    dietaryNotes: t.string().optional(),
    notes: t.string().optional(),
    contactEmail: t.string().optional(),
    contactPhone: t.string().optional(),
  },
  (
    ctx,
    {
      adminSecret,
      guestId,
      rsvpStatus,
      dietaryNotes,
      notes,
      contactEmail,
      contactPhone,
    }
  ) => {
    requireAdminAccess(ctx, adminSecret);
    const guest = ctx.db.guest.id.find(guestId);
    if (!guest) {
      throw new SenderError('Guest not found.');
    }

    const normalizedStatus = normalizeRsvpStatus(rsvpStatus);
    const normalizedDietary = normalizeOptional(dietaryNotes);
    const normalizedNotes = normalizeOptional(notes);
    const normalizedEmail = normalizeOptional(contactEmail);
    const normalizedPhone = normalizeOptional(contactPhone);

    const existingResponse = ctx.db.rsvp_response.guestId.find(guestId);
    if (normalizedStatus === RSVP_STATUS_PENDING) {
      if (existingResponse) {
        ctx.db.rsvp_response.id.delete(existingResponse.id);
      }
      for (const companion of ctx.db.companion.companion_guest_id.filter(guestId)) {
        ctx.db.companion.id.delete(companion.id);
      }
    } else {
      const attendance = normalizedStatus === RSVP_STATUS_ATTENDING;
      if (existingResponse) {
        ctx.db.rsvp_response.id.update({
          ...existingResponse,
          attendance,
          dietaryNotes: normalizedDietary,
          notes: normalizedNotes,
          updatedAt: ctx.timestamp,
        });
      } else {
        ctx.db.rsvp_response.insert({
          id: 0n,
          guestId,
          attendance,
          dietaryNotes: normalizedDietary,
          notes: normalizedNotes,
          submitted: true,
          updatedAt: ctx.timestamp,
        });
      }
    }

    ctx.db.guest.id.update({
      ...guest,
      rsvpStatus: normalizedStatus,
      contactEmail: normalizedEmail,
      contactPhone: normalizedPhone,
      updatedAt: ctx.timestamp,
    });
  }
);

export const admin_replace_guest_companions = spacetimedb.reducer(
  {
    adminSecret: t.string(),
    guestId: t.u64(),
    companions: t.array(CompanionInput),
  },
  (ctx, { adminSecret, guestId, companions }) => {
    requireAdminAccess(ctx, adminSecret);
    const guest = ctx.db.guest.id.find(guestId);
    if (!guest) {
      throw new SenderError('Guest not found.');
    }

    for (const existingCompanion of ctx.db.companion.companion_guest_id.filter(guestId)) {
      ctx.db.companion.id.delete(existingCompanion.id);
    }

    const maxCompanions = 5;
    for (const companion of companions.slice(0, maxCompanions)) {
      const name = companion.name.trim();
      if (!name) {
        continue;
      }
      ctx.db.companion.insert({
        id: 0n,
        guestId,
        name,
        dietaryNotes: normalizeOptional(companion.dietaryNotes),
        relationship: normalizeOptional(companion.relationship),
        updatedAt: ctx.timestamp,
      });
    }
  }
);

export const admin_bulk_set_rsvp_status = spacetimedb.reducer(
  {
    adminSecret: t.string(),
    guestIds: t.array(t.u64()),
    rsvpStatus: t.string(),
  },
  (ctx, { adminSecret, guestIds, rsvpStatus }) => {
    requireAdminAccess(ctx, adminSecret);
    const normalizedStatus = normalizeRsvpStatus(rsvpStatus);
    for (const guestId of guestIds) {
      setGuestRsvpStatus(ctx, guestId, normalizedStatus);
    }
  }
);

export const admin_upsert_guest = spacetimedb.reducer(
  {
    adminSecret: t.string(),
    firstName: t.string(),
    lastName: t.string(),
    inviteCode: t.string(),
    contactEmail: t.string().optional(),
    contactPhone: t.string().optional(),
  },
  (ctx, payload) => {
    requireAdminAccess(ctx, payload.adminSecret);
    const firstName = payload.firstName.trim();
    const lastName = payload.lastName.trim();
    const inviteCode = normalizeInviteCode(payload.inviteCode);
    if (!firstName || !lastName || !inviteCode) {
      throw new SenderError('First name, last name, and invite code are required.');
    }

    const contactEmail = normalizeOptional(payload.contactEmail);
    const contactPhone = normalizeOptional(payload.contactPhone);
    const existingByInviteCode = ctx.db.guest.inviteCode.find(inviteCode);

    if (existingByInviteCode) {
      ctx.db.guest.id.update({
        ...existingByInviteCode,
        firstName,
        lastName,
        contactEmail,
        contactPhone,
        updatedAt: ctx.timestamp,
      });
      return;
    }

    ctx.db.guest.insert({
      id: 0n,
      firstName,
      lastName,
      inviteCode,
      contactEmail,
      contactPhone,
      rsvpStatus: RSVP_STATUS_PENDING,
      updatedAt: ctx.timestamp,
    });
  }
);

export const admin_delete_guest = spacetimedb.reducer(
  {
    adminSecret: t.string(),
    guestId: t.u64(),
  },
  (ctx, { adminSecret, guestId }) => {
    requireAdminAccess(ctx, adminSecret);
    deleteGuestRecords(ctx, guestId);
  }
);

export const admin_set_guest_message_status = spacetimedb.reducer(
  {
    adminSecret: t.string(),
    messageId: t.u64(),
    status: t.string(),
  },
  (ctx, { adminSecret, messageId, status }) => {
    requireAdminAccess(ctx, adminSecret);
    const message = ctx.db.guest_message.id.find(messageId);
    if (!message) {
      throw new SenderError('Message not found.');
    }
    ctx.db.guest_message.id.update({
      ...message,
      status: normalizeMessageStatus(status),
    });
  }
);
