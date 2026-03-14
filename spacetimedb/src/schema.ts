import { CaseConversionPolicy, schema, table, t } from 'spacetimedb/server';

export const Guest = table(
  {
    name: 'guest',
  },
  {
    id: t.u64().primaryKey().autoInc(),
    firstName: t.string(),
    lastName: t.string(),
    inviteCode: t.string().unique(),
    qrToken: t.string().unique(),
    contactEmail: t.string().optional(),
    contactPhone: t.string().optional(),
    rsvpStatus: t.string(),
    updatedAt: t.timestamp(),
  }
);

export const RsvpResponse = table(
  {
    name: 'rsvp_response',
  },
  {
    id: t.u64().primaryKey().autoInc(),
    guestId: t.u64().unique(),
    attendance: t.bool(),
    dietaryNotes: t.string().optional(),
    notes: t.string().optional(),
    submitted: t.bool(),
    updatedAt: t.timestamp(),
  }
);

export const Companion = table(
  {
    name: 'companion',
    indexes: [
      {
        accessor: 'companion_guest_id',
        algorithm: 'btree',
        columns: ['guestId'],
      },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    guestId: t.u64(),
    name: t.string(),
    dietaryNotes: t.string().optional(),
    relationship: t.string().optional(),
    updatedAt: t.timestamp(),
  }
);

export const GuestMessage = table(
  {
    name: 'guest_message',
    indexes: [
      {
        accessor: 'guest_message_guest_id',
        algorithm: 'btree',
        columns: ['guestId'],
      },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    guestId: t.u64(),
    message: t.string(),
    status: t.string(),
    createdAt: t.timestamp(),
  }
);

export const GuestSession = table(
  {
    name: 'guest_session',
    indexes: [
      {
        accessor: 'guest_session_guest_id',
        algorithm: 'btree',
        columns: ['guestId'],
      },
    ],
  },
  {
    sender: t.identity().primaryKey(),
    guestId: t.u64(),
    verifiedAt: t.timestamp(),
  }
);

export const AdminIdentity = table(
  {
    name: 'admin_identity',
  },
  {
    id: t.u64().primaryKey(),
    identity: t.identity().unique(),
    claimedAt: t.timestamp(),
  }
);

const spacetimedb = schema(
  {
    admin_identity: AdminIdentity,
    guest: Guest,
    rsvp_response: RsvpResponse,
    companion: Companion,
    guest_message: GuestMessage,
    guest_session: GuestSession,
  },
  {
    CASE_CONVERSION_POLICY: CaseConversionPolicy.None,
  }
);

export default spacetimedb;
