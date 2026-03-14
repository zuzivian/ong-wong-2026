import { SenderError, t } from 'spacetimedb/server';
import spacetimedb from './schema';
import { RSVP_CUTOFF_AT_MICROS } from '../../shared/globals';

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
  return ctx.timestamp.microsSinceUnixEpoch > RSVP_CUTOFF_AT_MICROS;
}

function setGuestRsvpStatus(
  ctx: Parameters<typeof identify_guest_by_token>[0],
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

export const init = spacetimedb.init(() => {});

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

export const admin_update_guest_rsvp = spacetimedb.reducer(
  {
    guestId: t.u64(),
    rsvpStatus: t.string(),
    dietaryNotes: t.string().optional(),
    notes: t.string().optional(),
    contactEmail: t.string().optional(),
    contactPhone: t.string().optional(),
    canAddCompanions: t.bool(),
    maxCompanions: t.u64(),
  },
  (
    ctx,
    {
      guestId,
      rsvpStatus,
      dietaryNotes,
      notes,
      contactEmail,
      contactPhone,
      canAddCompanions,
      maxCompanions,
    }
  ) => {
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
          updatedAt: ctx.timestamp,
        });
      }
    }

    ctx.db.guest.id.update({
      ...guest,
      rsvpStatus: normalizedStatus,
      canAddCompanions,
      maxCompanions,
      contactEmail: normalizedEmail,
      contactPhone: normalizedPhone,
      updatedAt: ctx.timestamp,
    });
  }
);

export const admin_replace_guest_companions = spacetimedb.reducer(
  {
    guestId: t.u64(),
    companions: t.array(CompanionInput),
  },
  (ctx, { guestId, companions }) => {
    const guest = ctx.db.guest.id.find(guestId);
    if (!guest) {
      throw new SenderError('Guest not found.');
    }

    for (const existingCompanion of ctx.db.companion.companion_guest_id.filter(guestId)) {
      ctx.db.companion.id.delete(existingCompanion.id);
    }

    if (!guest.canAddCompanions || guest.maxCompanions <= 0n) {
      return;
    }

    const maxCompanions = Number(guest.maxCompanions);
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
    guestIds: t.array(t.u64()),
    rsvpStatus: t.string(),
  },
  (ctx, { guestIds, rsvpStatus }) => {
    const normalizedStatus = normalizeRsvpStatus(rsvpStatus);
    for (const guestId of guestIds) {
      setGuestRsvpStatus(ctx, guestId, normalizedStatus);
    }
  }
);

export const admin_upsert_guest = spacetimedb.reducer(
  {
    firstName: t.string(),
    lastName: t.string(),
    inviteCode: t.string(),
    qrToken: t.string().optional(),
    canAddCompanions: t.bool(),
    maxCompanions: t.u64(),
    contactEmail: t.string().optional(),
    contactPhone: t.string().optional(),
  },
  (ctx, payload) => {
    const firstName = payload.firstName.trim();
    const lastName = payload.lastName.trim();
    const inviteCode = normalizeInviteCode(payload.inviteCode);
    if (!firstName || !lastName || !inviteCode) {
      throw new SenderError('First name, last name, and invite code are required.');
    }

    const qrToken = normalizeOptional(payload.qrToken) ?? `${inviteCode.toLowerCase()}-token`;
    const contactEmail = normalizeOptional(payload.contactEmail);
    const contactPhone = normalizeOptional(payload.contactPhone);
    const existingByInviteCode = ctx.db.guest.inviteCode.find(inviteCode);
    const existingByQr = ctx.db.guest.qrToken.find(qrToken);
    if (existingByQr && (!existingByInviteCode || existingByInviteCode.id !== existingByQr.id)) {
      throw new SenderError('QR token already exists for another guest.');
    }

    if (existingByInviteCode) {
      ctx.db.guest.id.update({
        ...existingByInviteCode,
        firstName,
        lastName,
        qrToken,
        canAddCompanions: payload.canAddCompanions,
        maxCompanions: payload.maxCompanions,
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
      qrToken,
      canAddCompanions: payload.canAddCompanions,
      maxCompanions: payload.maxCompanions,
      contactEmail,
      contactPhone,
      rsvpStatus: RSVP_STATUS_PENDING,
      updatedAt: ctx.timestamp,
    });
  }
);

export const admin_regenerate_guest_qr_token = spacetimedb.reducer(
  {
    guestId: t.u64(),
  },
  (ctx, { guestId }) => {
    const guest = ctx.db.guest.id.find(guestId);
    if (!guest) {
      throw new SenderError('Guest not found.');
    }

    const baseInviteCode = normalizeInviteCode(guest.inviteCode).toLowerCase();
    let suffix = 0n;
    let nextToken = '';
    while (true) {
      const micros = (ctx.timestamp.microsSinceUnixEpoch + suffix).toString(36);
      nextToken = `${baseInviteCode}-${micros}`;
      const existing = ctx.db.guest.qrToken.find(nextToken);
      if (!existing || existing.id === guest.id) {
        break;
      }
      suffix += 1n;
    }

    ctx.db.guest.id.update({
      ...guest,
      qrToken: nextToken,
      updatedAt: ctx.timestamp,
    });
  }
);

export const admin_set_guest_message_status = spacetimedb.reducer(
  {
    messageId: t.u64(),
    status: t.string(),
  },
  (ctx, { messageId, status }) => {
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
