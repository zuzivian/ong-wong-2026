import { DbConnection } from '@/module_bindings';
import type { Companion, Guest, GuestMessage, RsvpResponse } from '@/module_bindings/types';
import { getGuestPortalState } from '@/lib/spacetimedb-procedures';

export type GuestPreview = {
  firstName: string;
  lastName: string;
  inviteCode: string;
};

export type GuestPortalState = {
  previewGuest?: GuestPreview;
  activeGuest?: Guest;
  activeRsvp?: RsvpResponse;
  companions: Companion[];
  messages: GuestMessage[];
};

function normalizeInviteCode(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '');
  return normalized.length > 0 ? normalized : undefined;
}

export async function loadGuestPortalState(
  connection: DbConnection,
  inviteCode?: string
): Promise<GuestPortalState> {
  const result = await getGuestPortalState(connection, {
    inviteCode: normalizeInviteCode(inviteCode),
  });

  return {
    previewGuest: result.previewGuest ?? undefined,
    activeGuest: result.activeGuest ?? undefined,
    activeRsvp: result.activeRsvp ?? undefined,
    companions: [...(result.companions ?? [])],
    messages: [...(result.messages ?? [])],
  };
}
