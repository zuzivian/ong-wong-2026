import { SenderError, t } from 'spacetimedb/server';
import spacetimedb from './schema';

export { default } from './schema';

const SESSION_CONFIG_ID = 1n;
const RSVP_MESSAGE_NEW = 'new';
const RSVP_STATUS_ATTENDING = 'attending';
const RSVP_STATUS_DECLINING = 'declining';
const RSVP_STATUS_PENDING = 'pending';

const CompanionInput = t.object('CompanionInput', {
  name: t.string(),
  dietaryNotes: t.string().optional(),
  relationship: t.string().optional(),
});

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

function normalizeOptional(text: string | undefined): string | undefined {
  if (text === undefined) {
    return undefined;
  }
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireGuestForSender(ctx: Parameters<typeof identify_guest_by_token>[0]) {
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
  ctx: Parameters<typeof identify_guest_by_token>[0],
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

function isRsvpCutoffReached(ctx: Parameters<typeof identify_guest_by_token>[0]): boolean {
  const config = ctx.db.config.id.find(SESSION_CONFIG_ID);
  if (!config || !config.globalRsvpCutoffAt) {
    return false;
  }
  return ctx.timestamp.microsSinceUnixEpoch > config.globalRsvpCutoffAt.microsSinceUnixEpoch;
}

function upsertGuestSession(
  ctx: Parameters<typeof identify_guest_by_token>[0],
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

export const init = spacetimedb.init(ctx => {
  if (!ctx.db.config.id.find(SESSION_CONFIG_ID)) {
    ctx.db.config.insert({
      id: SESSION_CONFIG_ID,
      globalRsvpCutoffAt: undefined,
      updatedAt: ctx.timestamp,
    });
  }

  if (ctx.db.guest.iter().next().done !== true) {
    return;
  }

  ctx.db.guest.insert({
    id: 0n,
    firstName: 'Natasha',
    lastName: 'Wong',
    inviteCode: 'NW26-101',
    qrToken: 'nw26-token-101',
    canAddCompanions: true,
    maxCompanions: 2n,
    contactEmail: undefined,
    contactPhone: undefined,
    rsvpStatus: RSVP_STATUS_PENDING,
    updatedAt: ctx.timestamp,
  });

  ctx.db.guest.insert({
    id: 0n,
    firstName: 'Samuel',
    lastName: 'Ong',
    inviteCode: 'SO26-102',
    qrToken: 'so26-token-102',
    canAddCompanions: false,
    maxCompanions: 0n,
    contactEmail: undefined,
    contactPhone: undefined,
    rsvpStatus: RSVP_STATUS_PENDING,
    updatedAt: ctx.timestamp,
  });
});

export const on_connect = spacetimedb.clientConnected(() => {});

export const on_disconnect = spacetimedb.clientDisconnected(() => {});

export const identify_guest_by_token = spacetimedb.reducer(
  {
    token: t.string(),
  },
  (ctx, { token }) => {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      throw new SenderError('Invitation token is required.');
    }

    const guest = ctx.db.guest.qrToken.find(normalizedToken);
    if (!guest) {
      throw new SenderError('Invitation token not found.');
    }

    upsertGuestSession(ctx, guest.id);
  }
);

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

export const clear_guest_session = spacetimedb.reducer(ctx => {
  const existing = ctx.db.guest_session.sender.find(ctx.sender);
  if (existing) {
    ctx.db.guest_session.sender.delete(ctx.sender);
  }
});

export const set_global_rsvp_cutoff = spacetimedb.reducer(
  {
    cutoffAt: t.timestamp().optional(),
  },
  (ctx, { cutoffAt }) => {
    const existing = ctx.db.config.id.find(SESSION_CONFIG_ID);
    if (!existing) {
      ctx.db.config.insert({
        id: SESSION_CONFIG_ID,
        globalRsvpCutoffAt: cutoffAt,
        updatedAt: ctx.timestamp,
      });
      return;
    }

    if (cutoffAt) {
      const oneMinuteInMicros = 60_000_000n;
      if (cutoffAt.microsSinceUnixEpoch < ctx.timestamp.microsSinceUnixEpoch - oneMinuteInMicros) {
        throw new SenderError('Cutoff cannot be set in the past.');
      }
    }

    ctx.db.config.id.update({
      ...existing,
      globalRsvpCutoffAt: cutoffAt,
      updatedAt: ctx.timestamp,
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
        updatedAt: ctx.timestamp,
      });
    } else {
      ctx.db.rsvp_response.insert({
        id: 0n,
        guestId: guest.id,
        attendance: payload.attendance,
        dietaryNotes: nextDietaryNotes,
        notes: nextNotes,
        updatedAt: ctx.timestamp,
      });
    }

    const maxCompanions = Number(guest.maxCompanions);
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

    if (payload.attendance && guest.canAddCompanions && maxCompanions > 0) {
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
